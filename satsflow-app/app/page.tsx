"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";

export default function Home() {
  const { connected, connect } = useWallet();

  return (
    <div className="flex flex-col items-center text-center gap-10 pt-16">
      <div className="flex flex-col items-center gap-4 max-w-2xl">
        <span className="text-xs font-semibold tracking-widest text-orange-400 uppercase">
          Bitcoin-native payment streams on Stacks
        </span>
        <h1 className="text-4xl font-bold leading-tight">
          Stream <span className="text-orange-400">sBTC</span> per block,{" "}
          <br className="hidden sm:block" />
          settle on Bitcoin
        </h1>
        <p className="text-neutral-400 text-base max-w-lg">
          SatsFlow lets you stream real Bitcoin (sBTC) or STX continuously to
          multiple recipients. No bridging, no wrapping — secured by the
          Bitcoin finality of Stacks.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-1">
          <span className="text-xs px-3 py-1 rounded-full bg-orange-900/40 text-orange-300 border border-orange-800/50">sBTC-first</span>
          <span className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">Multi-recipient</span>
          <span className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">Cancel any time</span>
          <span className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">No bridges</span>
        </div>

        {connected ? (
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <Link href="/send" className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
              Create Stream
            </Link>
            <Link href="/receive" className="px-5 py-2.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors">
              View Received
            </Link>
            <Link href="/demo" className="px-5 py-2.5 rounded border border-orange-800 text-orange-400 hover:bg-orange-900/30 transition-colors">
              Try Demo ↗
            </Link>
          </div>
        ) : (
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <button onClick={connect} className="px-6 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
              Connect Wallet to Start
            </button>
            <Link href="/demo" className="px-5 py-2.5 rounded border border-orange-800 text-orange-400 hover:bg-orange-900/30 transition-colors">
              Try Demo ↗
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-4">
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

      <p className="text-xs text-neutral-600 mt-4 font-mono">
        Deployed on Stacks Testnet · Contract: satsflow-streams-v5
      </p>
    </div>
  );
}
