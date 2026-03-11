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
    <div className="w-full max-w-md rounded-2xl border border-neutral-700/60 bg-neutral-900/80 backdrop-blur p-6 shadow-2xl text-left">
      {/* Card header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-0.5 font-semibold">Live stream simulation</p>
          <p className="text-sm font-bold text-white">Contributor Payroll</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/30 border border-green-800/50 rounded-full px-3 py-1 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Active
        </span>
      </div>

      {/* Drain bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-neutral-500">Balance draining in real time</span>
          <span className="font-mono text-orange-300 font-semibold">{remaining.toFixed(6)} sBTC</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-100"
            style={{ width: `${Math.max(0, 100 - drainPct).toFixed(3)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-neutral-700 mt-1">
          <span>0 sBTC</span>
          <span>{DEPOSIT} sBTC</span>
        </div>
      </div>

      {/* Recipients */}
      <div className="rounded-xl bg-neutral-800/50 divide-y divide-neutral-800 overflow-hidden">
        {LIVE_RECIPIENTS.map((r) => {
          const accrued = r.rate * elapsed;
          return (
            <div key={r.label} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-900/50 border border-orange-800/50 flex items-center justify-center text-[10px] font-bold text-orange-400">
                  {r.label[0].toUpperCase()}
                </span>
                <span className="text-xs text-orange-300 font-medium">{r.label}</span>
              </div>
              <div className="text-right">
                <div className="font-mono text-green-400 text-sm font-bold tabular-nums">
                  +{accrued.toFixed(8)}
                </div>
                <div className="text-[10px] text-neutral-600">sBTC accrued</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-neutral-700 mt-3 text-center">
        Simulation · 1 demo block = 3 s · real Stacks blocks ≈ 10 min
      </p>
    </div>
  );
}

export default function Home() {
  const { connected, connect } = useWallet();

  return (
    <div className="flex flex-col items-center gap-16 pt-16 pb-16">

      {/* ── Hero ── two-column on lg+ */}
      <div className="w-full max-w-6xl px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

        {/* Left: copy */}
        <div className="flex-1 flex flex-col gap-5 items-start text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-800/60 bg-orange-900/20 text-xs font-semibold text-orange-300 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
            Bitcoin-native · Powered by Stacks
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight">
            Stream{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              value
            </span>
            <br />
            like water
          </h1>

          <p className="text-neutral-400 text-lg leading-relaxed max-w-md">
            Pay contributors, teams, and services in real-time — every Bitcoin block,
            automatically. No invoices, no delays, no trust required.
          </p>

          {connected ? (
            <div className="flex gap-3 items-center">
              <Link href="/send" className="px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold transition-colors shadow-lg shadow-orange-900/40">
                Create Stream
              </Link>
              <Link href="/receive" className="px-6 py-3 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 font-medium transition-colors">
                View Received
              </Link>
            </div>
          ) : (
            <div className="flex gap-3 items-center">
              <button onClick={connect} className="px-7 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold transition-colors shadow-lg shadow-orange-900/40">
                Connect Wallet
              </button>

            </div>
          )}
        </div>

        {/* Right: live widget */}
        <div className="flex-1 flex justify-center w-full">
          <HeroLiveDemo />
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="w-full max-w-3xl flex items-center gap-4 px-4">
        <div className="flex-1 h-px bg-neutral-800" />
        <span className="text-xs text-neutral-600 uppercase tracking-widest">How it works</span>
        <div className="flex-1 h-px bg-neutral-800" />
      </div>

      {/* ── Steps ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl px-4">
        {[
          { step: "1", title: "Create a stream",        body: "Set recipients with individual rates, choose sBTC or STX, lock in your deposit." },
          { step: "2", title: "Funds accrue each block", body: "Every Stacks block, each recipient earns their share. Top up or cancel any time." },
          { step: "3", title: "Recipients withdraw",    body: "Claim all accrued sBTC to a Bitcoin-backed wallet — any time, no lock-in." },
        ].map(({ step, title, body }) => (
          <div key={step} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-left">
            <div className="text-orange-400 font-bold text-sm mb-2">Step {step}</div>
            <div className="font-semibold mb-1 text-neutral-100">{title}</div>
            <div className="text-sm text-neutral-400 leading-relaxed">{body}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-700 font-mono">
        Stacks Testnet · satsflow-streams-v5
      </p>
    </div>
  );
}

