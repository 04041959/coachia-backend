import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const conversations = {};

const ALEX_SYSTEM_PROMPT = `
Tu es Alex, un coach conversationnel doué, chaleureux, calme et bienveillant.

Tu aides l'utilisateur dans les domaines suivants :
- émotions ;
- relations ;
- solitude ;
- confiance en soi ;
- communication ;
- blessures affectives ;
- amour ;
- famille ;
- conflits ;
- motivation personnelle.

Tu n'es pas un professeur.
Tu n'es pas un thérapeute.
Tu ne fais pas de longs cours.
Tu ne poses pas de diagnostic médical ou psychologique.

Ta priorité est d'écouter, reformuler, rassurer et aider l'utilisateur à avancer pas à pas.

RÈGLES DE LONGUEUR :
- question simple : 50 mots maximum ;
- question moyenne : 80 mots maximum ;
- question complexe : 120 mots maximum ;
- émotion forte : 150 mots maximum.

Quand la question est complexe :
1. Reformule brièvement.
2. Identifie les sujets importants.
3. Ne traite qu'un seul sujet à la fois.
4. Termine par une question simple.

Évite les longues listes.
Maximum 3 points si une liste est nécessaire.

Tu dois parler comme un humain bienveillant, pas comme un manuel.
Ton style doit donner envie à l'utilisateur de continuer à parler.

Si le sujet touche à la santé mentale, reste prudent :
- encourage l'écoute ;
- évite les diagnostics ;
- conseille de consulter un professionnel si nécessaire ;
- reste humain et rassurant.

Réponds toujours dans la langue de l'utilisateur.
`;

// Route test
app.get("/", (req, res) => {
  res.send("Coachia backend is running ✅");
});

// Chat Alex
app.get("/chatAlex", async (req, res) => {
  try {
    const message = req.query.message || "";
    const conversationId = req.query.conversationId || "default";

    console.log("💬 Message reçu :", message);
    console.log("🧠 Conversation ID :", conversationId);

    if (!message.trim()) {
      return res.json({
        reply: "Je suis là. Dis-moi simplement ce que tu ressens ou ce que tu veux partager.",
      });
    }

    if (!conversations[conversationId]) {
      conversations[conversationId] = [
        {
          role: "system",
          content: ALEX_SYSTEM_PROMPT,
        },
      ];
    }

    conversations[conversationId].push({
      role: "user",
      content: message,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversations[conversationId],
      temperature: 0.7,
      max_tokens: 220,
    });

    let reply = completion.choices[0].message.content.trim();

    conversations[conversationId].push({
      role: "assistant",
      content: reply,
    });

    console.log("✅ Réponse Alex générée :", reply);

    res.json({ reply });
  } catch (error) {
    console.error("❌ Erreur chatAlex :", error);
    res.status(500).json({
      reply: "Je suis désolé, j'ai eu un petit blocage. Peux-tu reformuler simplement ta question ?",
    });
  }
});

// Génération voix Alex MP3
app.get("/generateAlexVoiceMp3", async (req, res) => {
  try {
    const text = req.query.text || "";

    console.log("🔊 Texte voix reçu :", text);

    if (!text.trim()) {
      return res.status(400).send("Texte vide");
    }

    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    console.log("✅ MP3 Alex généré. Taille :", buffer.length);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
    });

    res.send(buffer);
  } catch (error) {
    console.error("❌ Erreur génération MP3 :", error);
    res.status(500).send("Erreur génération voix");
  }
});

// Transcription audio utilisateur
app.post("/transcribeUserAudio", upload.single("audio"), async (req, res) => {
  try {
    console.log("🎙️ Route transcribeUserAudio appelée");
    console.log("📁 Fichier reçu :", req.file);

    if (!req.file) {
      return res.status(400).json({
        transcription: "Aucun fichier audio reçu.",
      });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
    });

    fs.unlinkSync(req.file.path);

    console.log("✅ Transcription réussie :", transcription.text);

    res.json({
      transcription: transcription.text,
    });
  } catch (error) {
    console.error("❌ Erreur transcription :", error);

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({
      transcription: "Transcription échouée.",
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
