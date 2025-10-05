// /api/ai-insights.js
import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { logs } = req.body;
    if (!logs || logs.length === 0) {
      return res.status(400).json({ error: "No logs provided" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // 👈 Make sure this is set in Vercel or Supabase env
    });

    const formattedLogs = logs
      .map(
        (l) =>
          `• Date: ${new Date(l.created_at).toLocaleDateString()} | Severity: ${
            l.severity
          } | Symptoms: ${l.symptoms}`
      )
      .join("\n");

    const prompt = `
    You are a medical insights assistant. Analyze the following health logs and summarize:
    - Overall severity trend (improving, worsening, stable)
    - Most common symptoms
    - Average severity level
    - Give a short personalized suggestion
    
    Logs:
    ${formattedLogs}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: "You are a helpful health assistant." },
                 { role: "user", content: prompt }],
      max_tokens: 250,
    });

    const message = completion.choices[0].message.content;
    res.status(200).json({ insights: message });

  } catch (error) {
    console.error("AI Insights Error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
}
