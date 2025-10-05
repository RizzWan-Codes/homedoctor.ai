// /api/health-trend.js
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
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formattedLogs = logs
      .map(
        (l) =>
          `• Date: ${new Date(l.created_at).toLocaleDateString()} | Severity: ${
            l.severity
          } | Symptoms: ${l.symptoms}`
      )
      .join("\n");

    // 🧠 Different prompt — for trends, diet, and plans
    const prompt = `
    You are an expert health trend analyst, nutritionist, personal chef, and fitness coach.
    Analyze the user's health logs and provide a detailed report including:

    1. 📈 Health Trend: Is their health improving, worsening, or stable? Explain briefly.
    2. 🥦 Nutrition Goals: Specify recommended daily nutrient goals based on their symptoms (e.g. protein, carbs, fats).
    3. 📝 Diet Plan: Suggest a simple daily diet plan to meet those goals.
    4. 👨‍🍳 Recipes: Give 2 healthy, easy recipes that meet their nutrition goals. Include ingredients, steps, and approximate macros.
    5. 🏋️ Exercise Plan: Recommend a basic exercise plan (e.g. type, frequency, duration).
    6. 💡 Health Tips: Practical lifestyle tips to maintain or improve their condition.

    Keep it structured and concise. Avoid medical jargon.

    Logs:
    ${formattedLogs}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful health trend assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
    });

    const message = completion.choices[0].message.content;
    res.status(200).json({ trend: message });

  } catch (error) {
    console.error("Health Trend Error:", error);
    res.status(500).json({ error: "Failed to analyze health trend" });
  }
}
