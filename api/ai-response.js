// File: /api/ai-response.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // needs service key for update rights
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, name, age, gender, symptoms, severity, details } = req.body;

  // 1. Fetch user from DB
  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("coins")
    .eq("id", userId)
    .single();

  if (fetchError || !user) {
    return res.status(400).json({ error: "User not found" });
  }

  if (user.coins < 20) {
    return res.status(400).json({ error: "Not enough coins" });
  }

  // 2. Deduct 20 coins
  await supabase
    .from("users")
    .update({ coins: user.coins - 20 })
    .eq("id", userId);

  // 3. Build prompt
  const prompt = `
You are an AI health assistant. 
Patient details:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Symptoms: ${symptoms}
- Severity: ${severity}
- Additional Info: ${description}

Give a clear response with:
1. Likely conditions (top 2–3 possibilities).
2. Differential uncertainty (how unsure you are).
3. Urgency triage: GREEN (self-care), YELLOW (see GP soon), RED (urgent/emergency).
4. Next steps for the patient.

⚠️ Reminder: This is not a substitute for professional medical advice. In emergencies, call local emergency services.
`;

  try {
    // 4. Call OpenAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await aiRes.json();

    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({ error: "Invalid AI response" });
    }

    return res.status(200).json({
      message: data.choices[0].message.content.trim(),
      coins: user.coins - 20,
    });
  } catch (err) {
    console.error("AI API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
