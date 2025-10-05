// api/ai-response.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // KEEP THIS SAFE!
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Log incoming request for debugging
    console.log("Request body:", req.body);

    const { name, age, gender, symptoms, severity, details, userId } = req.body;

    // ✅ Now correctly checks required fields including userId
    if (!name || !age || !gender || !symptoms || !userId) {
      return res.status(400).json({ error: "Missing required fields", body: req.body });
    }

    // 🧾 Fetch user coins
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

    // 💸 Deduct coins
    const remainingCoins = profile.coins - 20;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: remainingCoins })
      .eq("id", userId);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ error: "Failed to update coins", details: updateError.message });
    }

    // 🧠 Build AI prompt (unchanged)
    const prompt = `
You are a professional medical AI assistant. Based on the following patient information, provide a clear, structured health assessment.

Patient Info:
- Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Severity: ${severity}
- Symptoms: ${symptoms}
- Additional Details: ${details}

Format the response in clean text with clear numbered points, no markdown, no asterisks, and no restating the patient info. Keep it short and precise.

Structure:
1. Most Likely Conditions (top 2–3 brief points)
2. Possible Uncertainties or Differential Diagnoses
3. Recommended Next Steps (short and practical)
4. Suggested Medications (3 common options with dosage)

Rules:
- Do NOT use *, #, or markdown formatting.
- Do NOT repeat the patient info.
- Keep language professional and concise.
`;

    let message = "No response from AI";

    try {
      // 🧠 Call OpenAI
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

    // ✅ Return both AI message & updated coin count
    return res.status(200).json({ message, remainingCoins });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error occurred", details: err.message });
  }
}

