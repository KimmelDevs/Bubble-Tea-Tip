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

// ---------- HMAC helpers ----------
async function importKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function verifySignature(body: string, timestamp: string, receivedSig: string): Promise<boolean> {
  const secret = process.env.CHECKOUT_HMAC_SECRET;
  if (!secret) throw new Error("CHECKOUT_HMAC_SECRET env var not set");

  // Reject requests older than 5 minutes (replay protection)
  const ts = Number(timestamp);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;

  const key      = await importKey(secret);
  const message  = `${timestamp}.${body}`;
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const expected = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare
  if (expected.length !== receivedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ receivedSig.charCodeAt(i);
  }
  return diff === 0;
}

// ---------- Route ----------
export async function POST(req: NextRequest) {
  const rawBody   = await req.text();
  const timestamp = req.headers.get("x-tip-timestamp") ?? "";
  const signature = req.headers.get("x-tip-signature") ?? "";

  const valid = await verifySignature(rawBody, timestamp, signature).catch(() => false);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, name, phone } = JSON.parse(rawBody);

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
              ...(phone ? { phone } : {}),
            },
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            payment_method_types: SUPPORTED_PAYMENT_METHODS,
            line_items: [
              {
                currency: "PHP",
                amount:   numAmount * 100,
                name:     `Tip ₱${numAmount} 💖`,
                quantity: 1,
              },
            ],
            success_url: `${origin}/success?amount=${numAmount}&name=${encodeURIComponent(name || "Friend")}`,
            cancel_url:  `${origin}`,
            description: `Tip ₱${numAmount} from ${name || "Anonymous"} — Salamat!`,
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
