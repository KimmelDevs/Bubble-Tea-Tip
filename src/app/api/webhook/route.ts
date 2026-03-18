import { NextRequest, NextResponse } from "next/server";
import mqtt from "mqtt";

const MQTT_BROKER = "mqtt://broker.hivemq.com";
const MQTT_TOPIC  = "bubble/tip";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event?.data?.attributes?.type;
  console.log("📨 Webhook received:", type);
  console.log("📦 Payload:", JSON.stringify(event?.data?.attributes).slice(0, 200));

  if (type === "checkout_session.payment.paid") {
    const lineItems   = event.data.attributes.data?.attributes?.line_items || [];
    const amountCents = lineItems[0]?.amount || 0;
    const amount      = amountCents / 100;

    console.log(`💰 Payment confirmed: ₱${amount}`);

    try {
      await new Promise<void>((resolve, reject) => {
        const client = mqtt.connect(MQTT_BROKER, {
          clientId: "vercel_" + Math.random().toString(16).slice(2),
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
                console.log(`📡 MQTT published ₱${amount}`);
                resolve();
              }
            }
          );
        });

        client.on("error", (err) => {
          clearTimeout(timer);
          client.end(true);
          reject(err);
        });
      });
    } catch (err) {
      console.error("MQTT failed:", err);
    }
  }

  return NextResponse.json({ received: true });
}