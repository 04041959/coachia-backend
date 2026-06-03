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

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: String(text),
      format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Erreur GET /generateAlexVoiceMp3 :", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur serveur",
    });
  }
});

// Route transcription audio utilisateur
app.post("/transcribeUserAudio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Aucun fichier audio reçu. Envoyez un champ multipart nommé 'audio'.",
      });
    }

    const file = new File(
      [req.file.buffer],
      req.file.originalname || "user-audio.mp3",
      {
        type: req.file.mimetype || "audio/mpeg",
      }
    );

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

    return res.json({
      success: true,
      text: transcription.text || "",
    });
  } catch (error) {
    console.error("Erreur POST /transcribeUserAudio :", error);
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

    return res.json({ reply });

  } catch (error) {
    console.error("Erreur GET /chatAlex :", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur GPT"
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
