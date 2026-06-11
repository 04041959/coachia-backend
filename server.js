import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mémoire temporaire des conversations
const conversations = {};

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// Route test
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Coachia backend fonctionne.",
  });
});

// Route Alex texte avec mémoire conversationnelle
app.get("/chatAlex", async (req, res) => {
  try {
    const message = req.query.message || "Bonjour Alex";
    const conversationId = req.query.conversationId || "default";

    if (!conversations[conversationId]) {
      conversations[conversationId] = [
        {
          role: "system",
          content:
            "Tu es Alex, un coach bienveillant, clair, humain et motivant. Tu réponds de façon naturelle, encourageante et concise. Tu tiens compte de l'historique de la conversation quand il est disponible.",
        },
      ];
    }

    conversations[conversationId].push({
      role: "user",
      content: String(message),
    });

    // Limite mémoire pour éviter une conversation trop longue
    const systemMessage = conversations[conversationId][0];
    const recentMessages = conversations[conversationId].slice(-20);

    const messagesForOpenAI = [
      systemMessage,
      ...recentMessages.filter((m) => m.role !== "system"),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesForOpenAI,
    });

    const reply = completion.choices[0]?.message?.content || "";

    conversations[conversationId].push({
      role: "assistant",
      content: reply,
    });

    res.json({
      success: true,
      reply,
      conversationId,
      memoryLength: conversations[conversationId].length,
    });
  } catch (error) {
    console.error("Erreur /chatAlex :", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Route reset mémoire Alex
app.get("/resetChatAlex", (req, res) => {
  const conversationId = req.query.conversationId || "default";

  delete conversations[conversationId];

  res.json({
    success: true,
    message: "Mémoire Alex réinitialisée.",
    conversationId,
  });
});

// Route voix Alex MP3
app.get("/generateAlexVoiceMp3", async (req, res) => {
  try {
    const text = req.query.text || "Bonjour, je suis Alex.";

    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: String(text),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", "inline; filename=alex.mp3");
    res.send(buffer);
  } catch (error) {
    console.error("Erreur /generateAlexVoiceMp3 :", error);
    res.status(500).json({
      success: false,
      error: error.message,
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

    let audioBuffer = null;
    let fileName = "user-audio.mp3";
    let mimeType = "audio/mpeg";

    if (req.file) {
      console.log("✅ Fichier multipart reçu");

      audioBuffer = req.file.buffer;
      fileName = req.file.originalname || "user-audio.mp3";
      mimeType = req.file.mimetype || "audio/mpeg";
    } else if (req.body && req.body.audio) {
      console.log("⚠️ Aucun req.file, mais req.body.audio existe");

      const audioValue = String(req.body.audio);
      console.log("Valeur req.body.audio :", audioValue);

      if (audioValue.startsWith("http://") || audioValue.startsWith("https://")) {
        console.log("🌐 Audio détecté comme URL");

        const audioResponse = await fetch(audioValue);

        if (!audioResponse.ok) {
          return res.status(400).json({
            success: false,
            error: "Impossible de télécharger l'audio depuis l'URL fournie.",
            audioValue,
            status: audioResponse.status,
          });
        }

        const arrayBuffer = await audioResponse.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);

        mimeType = audioResponse.headers.get("content-type") || "audio/mpeg";
        fileName = "user-audio-from-url.mp3";

        console.log("✅ Audio téléchargé depuis URL");
        console.log("MIME type :", mimeType);
        console.log("Taille :", audioBuffer.length);
      } else {
        return res.status(400).json({
          success: false,
          error: "Le champ audio existe mais ce n'est pas une URL exploitable.",
          audioValue,
          debug: {
            hasFile: false,
            bodyKeys: Object.keys(req.body || {}),
            contentType: req.headers["content-type"] || null,
          },
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: "Aucun fichier audio reçu.",
        debug: {
          hasFile: false,
          bodyKeys: Object.keys(req.body || {}),
          contentType: req.headers["content-type"] || null,
        },
      });
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Le fichier audio est vide.",
      });
    }

    const file = await toFile(audioBuffer, fileName, {
      type: mimeType,
    });

    console.log("📝 Envoi à OpenAI transcription...");
    console.log("Nom fichier :", fileName);
    console.log("Type MIME :", mimeType);
    console.log("Taille buffer :", audioBuffer.length);

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });

    console.log("✅ Transcription réussie :", transcription.text);

    return res.status(200).json({
      success: true,
      text: transcription.text || "",
      debug: {
        fileName,
        mimeType,
        size: audioBuffer.length,
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

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
