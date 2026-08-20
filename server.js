import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";


const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
 
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

MÉMOIRE DE CONVERSATION :
L'historique des messages fourni avec chaque requête constitue ta mémoire de la conversation.
Tu dois utiliser cet historique pour te souvenir des échanges précédents et assurer la continuité du dialogue.
Si l'information recherchée apparaît dans cet historique, réponds à partir de cette information.
Ne dis jamais que tu n'as pas accès aux conversations précédentes lorsque l'historique fourni contient ces échanges.
Si une information n'apparaît réellement pas dans l'historique fourni, dis simplement que tu ne la retrouves pas dans la conversation disponible.

GESTION DES INFORMATIONS À RETENIR :

Quand l'utilisateur te donne explicitement une information factuelle à retenir
(date, heure, rendez-vous, préférence, événement, engagement, nom, lieu, etc.),
tu dois d'abord comprendre et reformuler cette information correctement.

Si l'utilisateur dit :
"Souviens-toi que...",
"Retiens que...",
"Je veux que tu te souviennes que...",
ou une formulation équivalente,
ne réponds pas automatiquement que tu ne peux pas mémoriser.

Si l'information est présente dans le message actuel ou dans l'historique fourni,
considère qu'elle est disponible dans le contexte de conversation.

Réponds d'abord à la demande concrète de l'utilisateur.

PRIORITÉ AU MESSAGE ACTUEL :
Quand une information est explicitement donnée dans le message actuel,
utilise-la directement avant de raisonner sur tes capacités de mémoire.

EXEMPLE :
Utilisateur :
"Je veux que tu te souviennes que demain, 20 août 2026,
j'ai un rendez-vous à 14 h 30. Peux-tu me répéter la date et l'heure ?"

Bonne réponse :
"Oui. Ton rendez-vous est prévu le 20 août 2026 à 14 h 30."

Mauvaise réponse :
"Je ne peux pas conserver d'informations d'une conversation à l'autre."

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

const { data: storedMessages, error: messagesError } = await supabase
  .from("messages")
  .select("role, text, created_at")
  .eq("conversation_id", conversationId)
  .order("created_at", { ascending: true });

if (messagesError) {
  console.error("❌ Erreur lecture historique Supabase :", messagesError);
  throw messagesError;
}

console.log(
  "🧠 Messages Supabase trouvés :",
  storedMessages?.length || 0
);

const historyMessages = [
  {
    role: "system",
    content: ALEX_SYSTEM_PROMPT,
  },
  ...(storedMessages || [])
    .filter(
      (m) =>
        m.text &&
        (m.role === "user" || m.role === "assistant")
    )
    .map((m) => ({
      role: m.role,
      content: m.text,
    })),
];

// Sécurité : ajoute le message courant seulement s'il n'est pas déjà
// le dernier message utilisateur enregistré dans Supabase.
const lastMessage = historyMessages[historyMessages.length - 1];

if (
  !lastMessage ||
  lastMessage.role !== "user" ||
  lastMessage.content.trim() !== message.trim()
) {
  historyMessages.push({
    role: "user",
    content: message,
  });
}

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: historyMessages,
  temperature: 0.7,
  max_tokens: 220,
});

    const reply = completion.choices[0].message.content.trim();

    
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
  let tempFilePath = null;

  try {
    console.log("🎙️ Route transcribeUserAudio appelée");
    console.log("📁 Fichier reçu :", req.file);

    if (!req.file) {
      return res.status(400).json({
        transcription: "Aucun fichier audio reçu.",
      });
    }

    const originalName = req.file.originalname || "";

    const extension = originalName.toLowerCase().endsWith(".wav")
      ? ".wav"
      : originalName.toLowerCase().endsWith(".mp3")
      ? ".mp3"
      : originalName.toLowerCase().endsWith(".webm")
      ? ".webm"
      : originalName.toLowerCase().endsWith(".ogg")
      ? ".ogg"
      : originalName.toLowerCase().endsWith(".mp4")
      ? ".mp4"
      : ".m4a";

    tempFilePath = req.file.path + extension;

    fs.renameSync(req.file.path, tempFilePath);

    console.log("🎧 Fichier renommé pour Whisper :", tempFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: "whisper-1",
    });

    fs.unlinkSync(tempFilePath);

    console.log("✅ Transcription réussie :", transcription.text);

    res.json({
      transcription: transcription.text,
    });
  } catch (error) {
    console.error("❌ Erreur transcription :", error);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }

    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
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
