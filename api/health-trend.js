// /api/health-trend.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://iklnmtdeqorwvufewddr.supabase.co",
  process.env.SUPABASE_SERVICE_KEY // make sure this is set in Vercel env vars
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // 📝 Fetch health logs
    const { data: logs, error } = await supabase
      .from("health_logs")
      .select("severity, created_at, symptoms")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!logs || logs.length === 0) {
      return res.status(200).json({ message: "No health data yet." });
    }

    // 🧠 Prepare data for AI
    const severityMap = { Mild: 1, Moderate: 2, Severe: 3 };
    const severities = logs.map(l => severityMap[l.severity] || 1);
    const avg = severities.reduce((a,b)=>a+b,0) / severities.length;
    const mid = Math.floor(severities.length / 2);
    const earlyAvg = severities.slice(0, mid).reduce((a,b)=>a+b,0) / Math.max(mid,1);
    const recentAvg = severities.slice(mid).reduce((a,b)=>a+b,0) / Math.max(severities.length - mid, 1);

    let trendStatus = "";
    if (recentAvg < earlyAvg - 0.3) trendStatus = "improving";
    else if (recentAvg > earlyAvg + 0.3) trendStatus = "worsening";
    else trendStatus = "stable";

    const symptomsList = logs.map(l => l.symptoms).join("; ");

    // 🧠 Prompt for OpenAI
    const prompt = `
You are a world-class health assistant with 3 personas: Nutritionist 🥦, Personal Chef 👨‍🍳, and Fitness Trainer 🏋️.  
The user’s health severity trend is: ${trendStatus} (early avg: ${earlyAvg.toFixed(1)}, recent avg: ${recentAvg.toFixed(1)}).  
Average severity: ${avg.toFixed(1)} out of 3 (1=Mild, 3=Severe).

Their recent symptoms: ${symptomsList}.

Based on this:
1. Give a **short trend summary** (improving/worsening/stable).
2. Give **nutrition goals** (protein grams, carbs level, fats level, dietary restrictions).
3. Give a **diet plan** for a day (Breakfast, Lunch, Dinner, Snacks).
4. Provide **2 actual recipes** with ingredients, steps, and macro breakdown that match the goals.
5. Create an **exercise plan** suitable for their severity trend.
6. Give 3-5 **health tips** for improvement.

Return the result in a clean JSON format with keys: 
trendSummary, nutritionGoals, dietPlan, recipes, exercisePlan, tips.
    `;

    // 🤖 Ask OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are an expert health assistant." },
        { role: "user", content: prompt }
      ]
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error("health-trend.js error:", err);
    return res.status(500).json({ error: err.message });
  }
}
