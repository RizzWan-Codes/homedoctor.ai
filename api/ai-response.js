// pages/api/ai-response.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, age, gender, symptoms, severity, details, userId } = req.body;

    if (!name || !age || !gender || !symptoms || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch user coins
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) return res.status(400).json({ error: "User not found" });
    if (profile.coins < 20) return res.status(400).json({ error: "Not enough coins" });

    const remainingCoins = profile.coins - 20;

    // Deduct coins
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: remainingCoins })
      .eq("id", userId);

    if (updateError) throw updateError;

    // AI Prompt
    const prompt = `
You are an AI health assistant.
Patient details:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Symptoms: ${symptoms}
- Severity: ${severity}
- Additional Info: ${details || "None"}

Give a clear response in bullet points:
1. Likely conditions (top 2–3)
2. Differential uncertainty
3. Urgency triage: GREEN, YELLOW, RED
4. Next steps

⚠️ This is NOT a substitute for professional medical advice.
Always give answers in points rather than a paragraph.
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const message = aiData.choices?.[0]?.message?.content || "No response from AI";

    return res.status(200).json({ message, remainingCoins });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Something went wrong" });
  }
}
