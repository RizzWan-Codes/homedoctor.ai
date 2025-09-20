// api/ai-response.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role for secure write
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") 
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, age, gender, symptoms, severity, details, userId } = req.body;

    // Fetch user coins from DB
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      return res.status(400).json({ error: "User not found" });
    }

    if (profile.coins < 20) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    // Deduct 20 coins
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: profile.coins - 20 })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Build AI prompt
    const prompt = `
You are an AI health assistant. 
Patient details:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Symptoms: ${symptoms}
- Severity: ${severity}
- Additional Info: ${details}

Give a clear response in **bullet points**:
1. Likely conditions (top 2–3)
2. Differential uncertainty
3. Urgency triage: GREEN, YELLOW, RED
4. Next steps

⚠️ Reminder: This is not a substitute for professional medical advice.
Format as bullet points only.
`;

    let message = "No response from AI";
    try {
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

      // Always parse JSON safely
      const aiData = await aiRes.json();
      message = aiData.choices?.[0]?.message?.content || message;
    } catch (openAIError) {
      console.error("OpenAI fetch error:", openAIError);
      message = "AI service error. Try again later.";
    }

    res.status(200).json({ message, remainingCoins: profile.coins - 20 });
  } catch (err) {
    console.error(err);
    // ALWAYS return JSON, never plain text
    res.status(500).json({ error: "Something went wrong" });
  }
}
