import Razorpay from "razorpay";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, coins } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !user_id || !coins)
    return res.status(400).json({ error: "Missing required parameters" });

  // Verify signature
  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature !== razorpay_signature) {
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  try {
    // Fetch current coins
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user_id)
      .single();

    if (error) throw error;

    const updatedCoins = (profile.coins || 0) + coins;

    // Update coins
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: updatedCoins })
      .eq("id", user_id);

    if (updateError) throw updateError;

    res.status(200).json({ success: true, updatedCoins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
