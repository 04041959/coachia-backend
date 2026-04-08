// Route GPT texte
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
