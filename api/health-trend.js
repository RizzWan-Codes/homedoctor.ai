// /api/health-trend.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://iklnmtdeqorwvufewddr.supabase.co",
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    console.log("🚀 Health Trend API triggered");

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { userId } = req.body;
    console.log("📌 User ID:", userId);

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // 📝 Fetch logs from Supabase
    const { data: logs, error } = await supabase
      .from("health_logs")
      .select("severity, created_at, symptoms")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      throw error;
    }

    console.log("📝 Logs fetched:", logs);

    if (!logs || logs.length === 0) {
      return res.status(200).json({ message: "No health data yet." });
    }

    // Format logs
    const formattedLogs = logs
      .map(
        (l) =>
          `• Date: ${new Date(l.created_at).toLocaleDateString()} | Severity: ${
            l.severity
          } | Symptoms: ${l.symptoms}`
      )
      .join("\n");

    console.log("🧠 Formatted logs ready");

    const prompt = `
    You are a professional digital health assistant. Analyze the following health logs and provide:

    - 🩺 A short **trend analysis** (improving, worsening, stable)
    - 🥦 **Diet recommendations**
    - 🏋️ **Exercise recommendations**
    - 💡 3–5 **personalized health tips**

    Keep it conversational, no JSON.

    Logs:
    ${formattedLogs}
    `;

    console.log("🤖 Sending to OpenAI...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful health trend analyzer." },
        { role: "user", content: prompt }
      ],
      max_tokens: 400,
    });

    const message = completion.choices[0].message.content;
    console.log("✅ AI Response received");

    return res.status(200).json({ trend: message });

  } catch (err) {
    console.error("🔥 health-trend.js error:", err);
    return res.status(500).json({ error: err.message });
  }
}
