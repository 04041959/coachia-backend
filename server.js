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

    // CAS 1 : FlutterFlow envoie un vrai fichier multipart
    if (req.file) {
      console.log("✅ Fichier multipart reçu");

      audioBuffer = req.file.buffer;
      fileName = req.file.originalname || "user-audio.mp3";
      mimeType = req.file.mimetype || "audio/mpeg";
    }

    // CAS 2 : FlutterFlow envoie un champ audio dans req.body.audio
    else if (req.body && req.body.audio) {
      console.log("⚠️ Aucun req.file, mais req.body.audio existe");
      console.log("Valeur req.body.audio :", req.body.audio);

      const audioValue = String(req.body.audio);

      // Si c'est une URL
      if (audioValue.startsWith("http://") || audioValue.startsWith("https://")) {
        console.log("🌐 Audio détecté comme URL. Téléchargement...");

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
      }

      // Si ce n'est pas une URL exploitable
      else {
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
    }

    // CAS 3 : rien reçu
    else {
      console.log("❌ Aucun fichier audio reçu");

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

    const file = new File([audioBuffer], fileName, {
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
