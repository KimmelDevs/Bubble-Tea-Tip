"use client";

import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";

const BROKER_URL = "wss://broker.hivemq.com:8884/mqtt";
const TOPIC      = "bubble/tip";

const TIPS = [
  { amount: 10, emoji: "☕", label: "Maliit na tulong" },
  { amount: 20, emoji: "🌸", label: "Salamat!" },
  { amount: 30, emoji: "💖", label: "Ang bait mo!" },
];

export default function TipPage() {
  const clientRef                 = useRef<mqtt.MqttClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading]     = useState<number | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [tipCount, setTipCount]   = useState(0);
  const [name, setName]           = useState("");

  useEffect(() => {
    const client = mqtt.connect(BROKER_URL, { clean: true });
    clientRef.current = client;
    client.on("connect", () => setConnected(true));
    client.on("close",   () => setConnected(false));
    return () => { client.end(); };
  }, []);

  async function sendTip(amount: number) {
    if (loading) return;
    if (!name.trim()) {
      setError("Please enter your name first! 😊");
      return;
    }
    setError(null);
    setLoading(amount);

    try {
      const res  = await fetch("/api/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount, name: name.trim() }),
      });
      const data = await res.json();

      if (data.checkout_url) {
        setTipCount((c) => c + 1);
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || "Failed to create checkout");
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --rose:    #ff4d8d;
          --rose-lt: #ff85b3;
          --cream:   #fff5f8;
          --ink:     #1a0a12;
          --card-bg: rgba(255,255,255,0.72);
        }

        body {
          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          min-height: 100dvh;
          overflow-x: hidden;
        }

        .petals {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
        }
        .petal {
          position: absolute;
          border-radius: 50% 0 50% 0;
          opacity: 0.18;
          animation: fall linear infinite;
        }
        @keyframes fall {
          0%   { transform: translateY(-40px) rotate(0deg); opacity: 0; }
          10%  { opacity: 0.18; }
          90%  { opacity: 0.12; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }

        .page {
          position: relative; z-index: 1;
          min-height: 100dvh;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 24px 20px 40px;
          gap: 24px;
        }

        .header { text-align: center; }
        .avatar {
          width: 84px; height: 84px; border-radius: 50%;
          background: linear-gradient(135deg, var(--rose-lt), var(--rose));
          display: grid; place-items: center;
          font-size: 40px;
          margin: 0 auto 16px;
          box-shadow: 0 8px 32px rgba(255,77,141,0.35);
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { box-shadow: 0 8px 32px rgba(255,77,141,0.35); }
          50%      { box-shadow: 0 8px 48px rgba(255,77,141,0.6); }
        }
        .name-heading {
          font-family: 'Playfair Display', serif;
          font-size: clamp(2rem, 8vw, 3rem);
          font-weight: 900; color: var(--ink);
          letter-spacing: -1px; line-height: 1;
        }
        .tagline {
          margin-top: 6px; font-size: 15px; font-weight: 300;
          color: var(--rose); letter-spacing: 0.5px;
        }
        .status {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: #888; margin-top: 10px;
          justify-content: center;
        }
        .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #ccc; transition: background 0.4s;
        }
        .dot.on { background: #4ade80; box-shadow: 0 0 6px #4ade80; }

        /* Name input */
        .name-wrap { width: 100%; max-width: 360px; }
        .name-input {
          width: 100%;
          padding: 14px 18px;
          border-radius: 16px;
          border: 1.5px solid rgba(255,77,141,0.2);
          background: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          color: var(--ink);
          outline: none;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .name-input:focus {
          border-color: var(--rose);
          box-shadow: 0 0 0 3px rgba(255,77,141,0.1);
        }
        .name-input::placeholder { color: #ccc; }

        .tip-section { width: 100%; max-width: 360px; }
        .section-label {
          font-size: 11px; font-weight: 500; letter-spacing: 2px;
          text-transform: uppercase; color: #b0708a;
          margin-bottom: 14px; text-align: center;
        }
        .tip-grid { display: flex; flex-direction: column; gap: 12px; }

        .tip-btn {
          width: 100%; border: none; cursor: pointer;
          border-radius: 18px; padding: 0;
          background: var(--card-bg);
          backdrop-filter: blur(12px);
          box-shadow: 0 2px 16px rgba(255,77,141,0.1), 0 0 0 1.5px rgba(255,77,141,0.12);
          transition: transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
        }
        .tip-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(255,77,141,0.22), 0 0 0 1.5px rgba(255,77,141,0.25);
        }
        .tip-btn:active:not(:disabled) { transform: scale(0.97); }
        .tip-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .tip-btn-inner {
          display: flex; align-items: center;
          padding: 16px 20px; gap: 14px;
        }
        .tip-emoji {
          font-size: 28px; flex-shrink: 0;
          width: 48px; height: 48px; border-radius: 14px;
          background: linear-gradient(135deg, #ffe0ed, #ffc8dc);
          display: grid; place-items: center;
        }
        .tip-text { flex: 1; text-align: left; }
        .tip-amount {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 700;
          color: var(--ink); line-height: 1;
        }
        .tip-amount span { font-size: 14px; color: var(--rose); }
        .tip-sub { font-size: 12px; color: #b0708a; margin-top: 2px; }
        .tip-arrow { font-size: 18px; color: var(--rose-lt); }
        .gcash-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: #0070ba; color: white;
          font-size: 10px; font-weight: 600; letter-spacing: 0.5px;
          padding: 3px 8px; border-radius: 20px; margin-top: 4px;
        }
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,77,141,0.2);
          border-top-color: var(--rose);
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-box {
          width: 100%; max-width: 360px;
          background: #fff0f0; border: 1px solid #ffc0cb;
          border-radius: 14px; padding: 12px 16px;
          font-size: 13px; color: #c0392b; text-align: center;
        }
        .footer {
          font-size: 11px; color: #c0a0b0;
          text-align: center; line-height: 1.8;
        }
      `}</style>

      <div className="petals">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="petal" style={{
            left:              `${(i * 5.7) % 100}%`,
            background:        i % 2 === 0 ? "#ff4d8d" : "#f5c842",
            animationDuration: `${6 + (i * 1.3) % 8}s`,
            animationDelay:    `${(i * 0.7) % 6}s`,
            width:             `${8 + (i * 3) % 12}px`,
            height:            `${8 + (i * 3) % 12}px`,
          }}/>
        ))}
      </div>

      <main className="page">
        <div className="header">
          <div className="avatar">💖</div>
          <h1 className="name-heading">Tip Us</h1>
          <p className="tagline">Scan · Pay via GCash · Spread love 🌸</p>
          <div className="status">
            <div className={`dot ${connected ? "on" : ""}`} />
            <span>{connected ? "Ready to receive tips" : "Connecting…"}</span>
          </div>
        </div>

        {/* Name input */}
        <div className="name-wrap">
          <input
            className="name-input"
            type="text"
            placeholder="Enter your name 😊"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            maxLength={14}
          />
        </div>

        {/* Tip buttons */}
        <div className="tip-section">
          <p className="section-label">Choose an amount</p>
          <div className="tip-grid">
            {TIPS.map(({ amount, emoji, label }) => (
              <button
                key={amount}
                className="tip-btn"
                disabled={!!loading}
                onClick={() => sendTip(amount)}
              >
                <div className="tip-btn-inner">
                  <div className="tip-emoji">{emoji}</div>
                  <div className="tip-text">
                    <div className="tip-amount"><span>₱</span>{amount}</div>
                    <div className="tip-sub">{label}</div>
                    <div className="gcash-badge">💙 GCash</div>
                  </div>
                  {loading === amount
                    ? <div className="spinner" />
                    : <div className="tip-arrow">→</div>
                  }
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-box">⚠️ {error}</div>}

        <p className="footer">
          Secured by PayMongo 🇵🇭<br />
          {tipCount > 0 && `${tipCount} tip${tipCount > 1 ? "s" : ""} sent this session ✨`}
        </p>
      </main>
    </>
  );
}