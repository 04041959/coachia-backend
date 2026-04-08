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

// Route test
app.get("/", (req, res) => {
  res.send("Coachia backend is running.");
});

// Route audio
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

// Route GPT
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
              text: `Tu es Alex, un coach bienveillant, clair, profond et rassurant.
Tu aides l'utilisateur à comprendre sa situation et à avancer concrètement.
Réponds de manière humaine, simple et impactante.`
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
