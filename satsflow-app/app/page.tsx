"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";

export default function Home() {
  const { connected, connect } = useWallet();

  return (
    <div className="flex flex-col items-center text-center gap-10 pt-16">
      <div className="flex flex-col items-center gap-4 max-w-2xl">
        <span className="text-xs font-semibold tracking-widest text-orange-400 uppercase">
          Bitcoin-native payment streams
        </span>
        <h1 className="text-4xl font-bold leading-tight">
          Stream money per second, powered by{" "}
          <span className="text-orange-400">Stacks</span>
        </h1>
        <p className="text-neutral-400 text-base max-w-lg">
          SatsFlow lets you create continuous payment streams using STX or sBTC.
          Recipients withdraw accrued value any time. No lock-ins, cancel whenever.
        </p>
        {connected ? (
          <div className="flex gap-3 mt-2">
            <Link href="/send" className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
              Create Stream
            </Link>
            <Link href="/receive" className="px-5 py-2.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors">
              View Received
            </Link>
          </div>
        ) : (
          <button onClick={connect} className="mt-2 px-6 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
            Connect Wallet to Start
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-4">
        {[
          { step: "1", title: "Create a stream",       body: "Choose recipient, token (STX or sBTC), deposit amount, and rate per block." },
          { step: "2", title: "Funds accrue each block", body: "Every block, the recipient earns more. Top up or cancel any time." },
          { step: "3", title: "Recipient withdraws",   body: "Claim all accrued funds directly to the wallet at any time." },
        ].map(({ step, title, body }) => (
          <div key={step} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-left">
            <div className="text-orange-400 font-bold text-sm mb-2">Step {step}</div>
            <div className="font-semibold mb-1">{title}</div>
            <div className="text-sm text-neutral-400">{body}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-600 mt-4 font-mono">
        Deployed on Stacks Testnet
      </p>
    </div>
  );
}
