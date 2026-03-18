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

  if (type === "checkout_session.payment.paid") {
    const attrs       = event.data.attributes.data?.attributes;
    const lineItems   = attrs?.line_items || [];
    const amountCents = lineItems[0]?.amount || 0;
    const amount      = amountCents / 100;
    const name        = attrs?.metadata?.tipper_name || "Friend";

    console.log(`💰 Payment confirmed: ₱${amount} from ${name}`);

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
            JSON.stringify({ amount, name }),
            { qos: 1 },
            (err) => {
              clearTimeout(timer);
              client.end();
              if (err) { reject(err); }
              else {
                console.log(`📡 MQTT published ₱${amount} from ${name}`);
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