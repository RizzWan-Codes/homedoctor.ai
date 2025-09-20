import Razorpay from "razorpay";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { coins } = req.body;

  if (!coins || coins < 20 || coins % 20 !== 0)
    return res.status(400).json({ error: "Coins must be in multiples of 20 and >= 20" });

  const amount = coins * 100; // Razorpay amount in paise (₹1 = 100 paise)

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      payment_capture: 1,
    });
    res.status(200).json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
