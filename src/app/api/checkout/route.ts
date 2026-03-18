import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { amount, name } = await req.json();

  if (![10, 20, 30].includes(Number(amount))) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
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
            billing: { name: name || "Tipper" },
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            payment_method_types: ["gcash"],
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
            description: `Tip ₱${amount} from ${name} — Salamat!`,
            // Pass name in metadata so webhook can read it
            metadata: { tipper_name: name || "Friend" },
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