import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Coachia backend is running.");
});

app.post("/generateAlexVoice", async (req, res) => {
  try {
    const { text } = req.body;

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: text,
      instructions:
        "Speak slowly, warmly, calmly, with natural breathing.",
      response_format: "mp3"
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    const base64 = buffer.toString("base64");

    res.json({
      success: true,
      audio_base64: base64
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));