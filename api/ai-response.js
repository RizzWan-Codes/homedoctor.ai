// api/ai-response.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // KEEP THIS IN BACKEND ONLY
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Log the incoming body
    console.log("Request body:", req.body);

    const { name, age, gender, symptoms, severity, details, userId } = req.body;

    if (!name || !age || !gender || !symptoms || !userId) {
      return res.status(400).json({ error: "Missing required fields", body: req.body });
    }

    // Fetch user coins
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch user profile", details: fetchError.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    if (profile.coins < 20) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    // Deduct coins
    const remainingCoins = profile.coins - 20;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: remainingCoins })
      .eq("id", userId);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ error: "Failed to update coins", details: updateError.message });
    }

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

Give a clear response in bullet points:
1. Likely conditions (top 2–3)
2. Differential uncertainty
3. Urgency triage: GREEN, YELLOW, RED
4. Next steps

Reminder: This is not professional medical advice.
Format as bullet points only.
`;

    // Call OpenAI safely
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

      const aiData = await aiRes.json();

      // Log OpenAI response
      console.log("OpenAI response:", aiData);

      if (aiData.choices?.[0]?.message?.content) {
        message = aiData.choices[0].message.content;
      } else {
        console.error("OpenAI returned unexpected data:", aiData);
      }
    } catch (openAiErr) {
      console.error("OpenAI fetch error:", openAiErr);
      message = `AI request failed: ${openAiErr.message}`;
    }

    // Always return JSON
    return res.status(200).json({ message, remainingCoins });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error occurred", details: err.message });
  }
}
