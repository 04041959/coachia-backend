import express from "express";
import cors from "cors";
import OpenAI from "openai";
import multer from "multer";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// Route test
app.get("/", (req, res) => {
  res.send("Coachia backend is running.");
});

// Route audio Alex
app.get("/generateAlexVoiceMp3", async (req, res) => {
  try {
    const text = req.query.text;

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        success: false,
        error: "Le paramètre 'text' est obligatoire.",
      });
    }

    console.log("🔊 GET /generateAlexVoiceMp3 appelé");
    console.log("Texte reçu :", String(text).slice(0, 120));

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: String(text),
      format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    console.log("✅ MP3 Alex généré. Taille :", buffer.length, "octets");

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("❌ Erreur GET /generateAlexVoiceMp3 :", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur serveur",
    });
  }
});

// Route transcription audio utilisateur
app.post("/transcribeUserAudio", upload.single("audio"), async (req, res) => {
  try {
    console.log("🎙️ Route POST /transcribeUserAudio appelée");
    console.log("Headers content-type :", req.headers["content-type"]);
    console.log("Body reçu :", req.body);
    console.log("Fichier reçu :", req.file);

    if (!req.file) {
      console.log("❌ Aucun fichier audio reçu dans le champ 'audio'.");

      return res.status(400).json({
        success: false,
        error: "Aucun fichier audio reçu. Envoyez un champ multipart nommé 'audio'.",
        debug: {
          hasFile: false,
          bodyKeys: Object.keys(req.body || {}),
          contentType: req.headers["content-type"] || null,
        },
      });
    }

    console.log("✅ Fichier audio reçu");
    console.log("Nom original :", req.file.originalname);
    console.log("MIME type :", req.file.mimetype);
    console.log("Taille :", req.file.size, "octets");

    const safeFileName = req.file.originalname || "user-audio.mp3";
    const safeMimeType = req.file.mimetype || "audio/mpeg";

    const file = new File([req.file.buffer], safeFileName, {
      type: safeMimeType,
    });

    console.log("📝 Envoi à OpenAI transcription...");

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

    console.log("✅ Transcription réussie :", transcription.text);

    return res.status(200).json({
      success: true,
      text: transcription.text || "",
      debug: {
        fileName: safeFileName,
        mimeType: safeMimeType,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error("❌ Erreur POST /transcribeUserAudio :", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur transcription audio",
    });
  }
});

// Route GPT Alex
app.get("/chatAlex", async (req, res) => {
  try {
    const userMessage = req.query.message || "Bonjour";

    console.log("💬 GET /chatAlex appelé");
    console.log("Message utilisateur :", String(userMessage).slice(0, 200));

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `Tu es Alex, un coach relationnel chaleureux, humain, profond et rassurant.

Tu es spécialisé uniquement dans :
- les émotions ;
- les relations humaines ;
- la solitude ;
- la confiance en soi ;
- la communication ;
- les blessures émotionnelles ;
- les relations amoureuses ;
- les relations familiales ;
- les conflits humains ;
- l'écoute et le soutien émotionnel.

Tu n'es PAS un assistant généraliste.

Tu refuses avec douceur et respect les sujets hors de ton domaine :
- politique ;
- médecine ;
- droit ;
- fiscalité ;
- sport ;
- géographie ;
- informatique ;
- mathématiques ;
- cuisine ;
- actualité ;
- crypto ;
- technique ;
- ou tout autre sujet non relationnel.

Quand un utilisateur pose une question hors sujet :
- réponds avec chaleur ;
- reste bienveillant ;
- explique subtilement que ton rôle est centré sur l'humain et les relations ;
- recentre la discussion sur les émotions, les relations ou le vécu personnel.

Exemple :
"Je comprends ta question 😊. Mon rôle principal est de t’accompagner sur le plan humain, émotionnel et relationnel. Si cette situation crée du stress, de la confusion ou un impact émotionnel dans ta vie, je peux t’aider à en parler."

Réponds toujours dans la langue de l’utilisateur.

Sois naturel, humain, empathique, subtil et encourageant.`
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: String(userMessage)
            }
          ]
        }
      ]
    });

    const reply = response.output_text || "Je suis là pour vous aider.";

    console.log("✅ Réponse Alex :", reply.slice(0, 200));

    return res.json({ reply });

  } catch (error) {
    console.error("❌ Erreur GET /chatAlex :", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur GPT"
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
