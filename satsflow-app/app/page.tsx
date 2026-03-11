"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";

const LIVE_RECIPIENTS = [
  { label: "alice.btc",  rate: 0.000_083_33 },
  { label: "bob.stx",    rate: 0.000_050_00 },
  { label: "carol.btc",  rate: 0.000_033_33 },
];
const DEPOSIT = 2.0;

function HeroLiveDemo() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // 1 "demo block" = 3 real seconds
  useEffect(() => {
    const t = setInterval(
      () => setElapsed((Date.now() - startRef.current) / 3000),
      100
    );
    return () => clearInterval(t);
  }, []);

  const totalRate    = LIVE_RECIPIENTS.reduce((s, r) => s + r.rate, 0);
  const totalAccrued = Math.min(totalRate * elapsed, DEPOSIT);
  const remaining    = DEPOSIT - totalAccrued;
  const drainPct     = (totalAccrued / DEPOSIT) * 100;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-left shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-0.5">Live stream</p>
          <p className="text-sm font-semibold">Contributor Payroll</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/30 border border-green-800/50 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Active
        </span>
      </div>

      {/* Drain bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-neutral-500 mb-1.5">
          <span>Balance draining</span>
          <span className="font-mono text-orange-300">{remaining.toFixed(6)} sBTC</span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-100"
            style={{ width: `${(100 - drainPct).toFixed(3)}%` }}
          />
        </div>
      </div>

      {/* Recipients live */}
      <div className="flex flex-col gap-0 border-t border-neutral-800 pt-3">
        {LIVE_RECIPIENTS.map((r) => {
          const accrued = r.rate * elapsed;
          return (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-neutral-800/60 last:border-0">
              <span className="text-xs text-orange-400 font-medium">{r.label}</span>
              <div className="text-right">
                <div className="font-mono text-green-400 text-sm tabular-nums">
                  +{accrued.toFixed(8)}
                </div>
                <div className="text-xs text-neutral-600">sBTC accrued</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const { connected, connect } = useWallet();

  return (
    <div className="flex flex-col items-center text-center gap-10 pt-12">

      {/* Hero: text left, live demo right */}
      <div className="flex flex-col lg:flex-row items-center gap-10 w-full max-w-5xl px-4">

        {/* Left: headline + CTAs */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-4 flex-1">
          <span className="text-xs font-semibold tracking-widest text-orange-400 uppercase">
            Bitcoin-native payment streams on Stacks
          </span>
          <h1 className="text-4xl font-bold leading-tight">
            Stream <span className="text-orange-400">sBTC</span> per block,{" "}
            <br className="hidden sm:block" />
            settle on Bitcoin
          </h1>
          <p className="text-neutral-400 text-base max-w-lg">
            SatsFlow streams real Bitcoin (sBTC) continuously to multiple
            recipients. No bridging, no wrapping — secured by Bitcoin
            finality via Stacks.
          </p>

          <div className="flex flex-wrap justify-center lg:justify-start gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-orange-900/40 text-orange-300 border border-orange-800/50">sBTC-first</span>
            <span className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">Multi-recipient</span>
            <span className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">Cancel any time</span>
            <span className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">No bridges</span>
          </div>

          {connected ? (
            <div className="flex gap-3 flex-wrap justify-center lg:justify-start">
              <Link href="/send" className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
                Create Stream
              </Link>
              <Link href="/receive" className="px-5 py-2.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors">
                View Received
              </Link>
              <Link href="/demo" className="px-5 py-2.5 rounded border border-orange-800 text-orange-400 hover:bg-orange-900/30 transition-colors">
                Full Demo ↗
              </Link>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap justify-center lg:justify-start">
              <button onClick={connect} className="px-6 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
                Connect Wallet to Start
              </button>
              <Link href="/demo" className="px-5 py-2.5 rounded border border-orange-800 text-orange-400 hover:bg-orange-900/30 transition-colors">
                Full Demo ↗
              </Link>
            </div>
          )}
        </div>

        {/* Right: animated live stream widget */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <HeroLiveDemo />
          <p className="text-xs text-neutral-700">
            demo · 1 block = 3 s · real blocks ≈ 10 min
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
        {[
          { step: "1", title: "Create a stream",       body: "Choose recipients (each with individual rates), select sBTC or STX, set your deposit." },
          { step: "2", title: "Funds accrue each block", body: "Every Stacks block, recipients earn their share. Top up or cancel any time — no lock-in." },
          { step: "3", title: "Recipients withdraw",   body: "Claim all accrued sBTC directly to a Bitcoin-backed wallet, any time." },
        ].map(({ step, title, body }) => (
          <div key={step} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-left">
            <div className="text-orange-400 font-bold text-sm mb-2">Step {step}</div>
            <div className="font-semibold mb-1">{title}</div>
            <div className="text-sm text-neutral-400">{body}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-600 font-mono pb-8">
        Deployed on Stacks Testnet · Contract: satsflow-streams-v5
      </p>
    </div>
  );
}


