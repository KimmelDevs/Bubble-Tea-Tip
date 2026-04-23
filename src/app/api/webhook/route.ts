import { NextRequest, NextResponse } from "next/server";
import * as mqtt from "mqtt";

// ── HMAC helper ───────────────────────────────────────────────
async function signMqttPayload(message: string): Promise<string> {
  const secret = process.env.MQTT_HMAC_SECRET;
  if (!secret) throw new Error("MQTT_HMAC_SECRET is not set");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── MQTT publish ──────────────────────────────────────────────
async function publishTip(amount: number, name: string) {
  const timestamp = String(Date.now());
  const message   = `${amount}|${name}|${timestamp}`;
  const sig       = await signMqttPayload(message);
  const payload   = JSON.stringify({ amount, name, timestamp, sig });

  console.log("[webhook] Publishing MQTT payload:", payload);

  await new Promise<void>((resolve, reject) => {
    const client = mqtt.connect("mqtts://broker.hivemq.com:8883", {
      clientId: `server-${Date.now()}`,
      clean: true,
    });
    client.on("connect", () => {
      console.log("[webhook] MQTT connected, publishing...");
      client.publish("bubble/tip", payload, { qos: 1 }, (err) => {
        client.end();
        err ? reject(err) : resolve();
      });
    });
    client.on("error", (err) => {
      console.error("[webhook] MQTT error:", err);
      reject(err);
    });
    setTimeout(() => reject(new Error("MQTT connect timeout")), 8000);
  });
}

// ── PayMongo webhook ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Log the full event so we can see exactly what PayMongo sends
  console.log("[webhook] Received event:", JSON.stringify(body, null, 2));

  const eventType = body?.data?.attributes?.type;
  console.log("[webhook] Event type:", eventType);

  // PayMongo checkout session events
  // type is on body.data.attributes.type
  // payment data is on body.data.attributes.data.attributes
  const isPaid =
    eventType === "checkout_session.payment.paid" ||
    eventType === "payment.paid"                  ||
    eventType === "checkout_session.completed";

  if (!isPaid) {
    console.log("[webhook] Ignoring event type:", eventType);
    return NextResponse.json({ received: true });
  }

  const sessionAttrs = body?.data?.attributes?.data?.attributes;
  if (!sessionAttrs) {
    console.error("[webhook] No session attributes found");
    return NextResponse.json({ received: true });
  }

  // Amount lives in the payments array, in centavos
  const payment = sessionAttrs?.payments?.[0]?.attributes;
  const amount  = (payment?.amount ?? sessionAttrs?.line_items?.[0]?.amount ?? 0) / 100;
  const name    = payment?.billing?.name ?? sessionAttrs?.metadata?.tipper_name ?? "Friend";

  console.log(`[webhook] ✅ Payment confirmed: ₱${amount} from ${name}`);

  try {
    await publishTip(amount, name);
    console.log(`[webhook] ✅ MQTT published successfully`);
  } catch (err) {
    console.error("[webhook] ❌ MQTT publish failed:", err);
    // Still return 200 so PayMongo doesn't retry
  }

  return NextResponse.json({ received: true });
}
