import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_PAYMENT_METHODS = [
  "gcash",
  "paymaya",
  "card",
  "grab_pay",
  "brankas_bdo",
  "brankas_landbank",
  "brankas_metrobank",
  "dob",
  "dob_ubp",
  "billease",
  "qrph",
];

export async function POST(req: NextRequest) {
  const { amount, name, phone } = await req.json(); // email removed from billing

  const numAmount = Number(amount);
  if (!numAmount || numAmount < 1 || !Number.isFinite(numAmount)) {
    return NextResponse.json({ error: "Invalid amount. Minimum tip is ₱1." }, { status: 400 });
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  try {
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          process.env.PAYMONGO_SECRET_KEY + ":"
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name:  name || "Anonymous",
              ...(phone ? { phone } : {}), // 👈 only phone, PayMongo collects email itself
            },
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            payment_method_types: SUPPORTED_PAYMENT_METHODS,
            line_items: [
              {
                currency: "PHP",
                amount:   amount * 100,
                name:     `Tip ₱${amount} 💖`,
                quantity: 1,
              },
            ],
            success_url: `${origin}/success?amount=${amount}&name=${encodeURIComponent(name || "Friend")}`,
            cancel_url:  `${origin}`,
            description: `Tip ₱${amount} from ${name || "Anonymous"} — Salamat!`,
            metadata: {
              tipper_name:  name  || "Anonymous",
              tipper_phone: phone || "",
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayMongo error:", data);
      return NextResponse.json(
        { error: data?.errors?.[0]?.detail || "PayMongo error" },
        { status: 500 }
      );
    }

    const checkoutUrl = data.data.attributes.checkout_url;
    return NextResponse.json({ checkout_url: checkoutUrl });

  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}