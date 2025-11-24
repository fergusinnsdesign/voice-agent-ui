export default async function handler(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1"
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview",
        instructions: "You are a friendly realtime agent."
      })
    });

    const data = await response.json();
    const eph = data?.client_secret?.value;

    if (!eph) {
      return res.status(500).json({ error: "OpenAI response missing key", data });
    }

    res.status(200).json({ ephemeral_key: eph });

  } catch (err) {
    res.status(500).json({ error: "Server error", details: String(err) });
  }
}
