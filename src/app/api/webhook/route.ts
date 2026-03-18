import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mqtt from "mqtt";

const MQTT_BROKER = "mqtt://broker.hivemq.com";
const MQTT_TOPIC  = "bubble/tip";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ── Verify PayMongo signature ─────────────────────────────
  const sigHeader    = req.headers.get("paymongo-signature") || "";
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (webhookSecret && sigHeader) {
    const parts: Record<string, string> = {};
    sigHeader.split(",").forEach((p) => {
      const [k, v] = p.split("=");
      parts[k] = v;
    });

    const hmac = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${parts.t}.${rawBody}`)
      .digest("hex");

    if (`v1=${hmac}` !== `v1=${parts.v1}`) {
      console.warn("⚠️  Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  // ── Parse event ───────────────────────────────────────────
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event?.data?.attributes?.type;
  console.log("📨 Webhook received:", type);

  if (type === "checkout_session.payment.paid") {
    const lineItems   = event.data.attributes.data?.attributes?.line_items || [];
    const amountCents = lineItems[0]?.amount || 0;
    const amount      = amountCents / 100;

    console.log(`💰 GCash payment confirmed: ₱${amount}`);

    // ── Publish to MQTT → ESP32 LCD ───────────────────────
    try {
      await new Promise<void>((resolve, reject) => {
        const client = mqtt.connect(MQTT_BROKER, {
          clientId: "vercel_webhook_" + Math.random().toString(16).slice(2),
          clean: true,
        });

        const timer = setTimeout(() => {
          client.end(true);
          reject(new Error("MQTT timeout"));
        }, 8000);

        client.on("connect", () => {
          client.publish(
            MQTT_TOPIC,
            JSON.stringify({ amount }),
            { qos: 1 },
            (err) => {
              clearTimeout(timer);
              client.end();
              if (err) {
                console.error("MQTT publish error:", err);
                reject(err);
              } else {
                console.log(`📡 MQTT published ₱${amount} to ${MQTT_TOPIC}`);
                resolve();
              }
            }
          );
        });

        client.on("error", (err) => {
          clearTimeout(timer);
          client.end(true);
          console.error("MQTT connection error:", err);
          reject(err);
        });
      });
    } catch (err) {
      console.error("Failed to publish MQTT:", err);
      // Still return 200 so PayMongo doesn't retry
    }
  }

  return NextResponse.json({ received: true });
}