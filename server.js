import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route de test
app.get("/", (req, res) => {
  res.send("Coachia backend is running.");
});

// Ancienne route JSON (tu peux la garder si tu veux)
app.post("/generateAlexVoice", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Le champ 'text' est obligatoire.",
      });
    }

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    res.json({
      success: true,
      audio_base64: buffer.toString("base64"),
    });
  } catch (error) {
    console.error("Erreur /generateAlexVoice :", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Erreur serveur",
    });
  }
});

// ✅ Nouvelle route : renvoie directement le MP3
app.post("/generateAlexVoiceMp3", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Le champ 'text' est obligatoire.",
      });
    }

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Erreur /generateAlexVoiceMp3 :", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Erreur serveur",
    });
  }
});

// ✅ Variante GET pratique pour FlutterFlow
app.get("/generateAlexVoiceMp3", async (req, res) => {
  try {
    const text = req.query.text;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Le paramètre 'text' est obligatoire.",
      });
    }

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
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

app.get("/chatAlex", async (req, res) => {
  try {
    const userMessage = req.query.message || "Bonjour";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Tu es Alex, un coach bienveillant, clair, profond et rassurant.
Tu aides l'utilisateur à comprendre sa situation et à avancer concrètement.
Réponds de manière humaine, simple et impactante.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
    });

    const reply = response.choices[0].message.content;

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur GPT" });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


