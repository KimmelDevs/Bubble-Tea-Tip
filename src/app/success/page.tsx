"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const amount = params.get("amount") || "?";
  const router = useRouter();
  const [count, setCount] = useState(3);

  useEffect(() => {
    const t = setInterval(() => {
      setCount((c) => c - 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (count <= 0) router.push("/");
  }, [count, router]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: #fff5f8;
          min-height: 100dvh;
          display: grid; place-items: center;
        }
        .card {
          text-align: center; padding: 48px 40px;
          background: white; border-radius: 32px;
          box-shadow: 0 24px 64px rgba(255,77,141,0.15);
          max-width: 320px; width: 90%;
          animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes popIn {
          from { transform: scale(0.8); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        .big  { font-size: 64px; margin-bottom: 16px; }
        h1 {
          font-family: 'Playfair Display', serif;
          font-size: 2.2rem; color: #ff4d8d; margin-bottom: 10px;
        }
        p    { color: #888; font-size: 14px; line-height: 1.7; }
        .amount {
          font-family: 'Playfair Display', serif;
          font-size: 2.8rem; font-weight: 900;
          color: #1a0a12; margin: 12px 0;
        }
        .amount span { color: #ff4d8d; font-size: 1.6rem; }
        .redirect { margin-top: 20px; font-size: 12px; color: #ccc; }
      `}</style>
      <div className="card">
        <div className="big">🎉</div>
        <h1>Salamat!</h1>
        <div className="amount"><span>₱</span>{amount}</div>
        <p>Your GCash tip was received!<br />Our screen is lighting up 💕</p>
        <p className="redirect">Going back in {count}s…</p>
      </div>
    </>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}