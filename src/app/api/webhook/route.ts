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

// ── PayMongo webhook ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();

  // PayMongo sends event type in data.attributes.type
  const type       = body?.data?.attributes?.type;
  const attributes = body?.data?.attributes?.data?.attributes;

  if (type !== "payment.paid" || !attributes) {
    return NextResponse.json({ received: true });
  }

  const amount    = (attributes.amount ?? 0) / 100;           // convert centavos → pesos
  const name      = attributes.billing?.name ?? "Friend";
  const timestamp = String(Date.now());

  // Build signed MQTT payload
  const message   = `${amount}|${name}|${timestamp}`;
  const sig       = await signMqttPayload(message);

  const payload   = JSON.stringify({ amount, name, timestamp, sig });

  // Publish to HiveMQ over TLS
  await new Promise<void>((resolve, reject) => {
    const client = mqtt.connect("mqtts://broker.hivemq.com:8883", {
      clientId: `server-${Date.now()}`,
      clean: true,
    });
    client.on("connect", () => {
      client.publish("bubble/tip", payload, { qos: 1 }, (err) => {
        client.end();
        err ? reject(err) : resolve();
      });
    });
    client.on("error", reject);
    setTimeout(() => reject(new Error("MQTT timeout")), 8000);
  });

  console.log(`[webhook] Published tip ₱${amount} from ${name}`);
  return NextResponse.json({ received: true });
}
