// api/check-health.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, age, gender, symptoms, severity, description } = req.body;

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

At last, give the user medicine names and doses according to the user's symptoms.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const data = await response.json();

    res.status(200).json({
      result: data.choices?.[0]?.message?.content || "No response from AI",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
}


