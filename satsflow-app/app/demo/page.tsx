"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const MOCK_RECIPIENTS = [
  { label: "alice.btc",   address: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ADW58ZM", rate: 0.00_008_333 },
  { label: "bob.stx",     address: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG", rate: 0.00_005_000 },
  { label: "carol.btc",   address: "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC", rate: 0.00_003_333 },
];
const TOTAL_RATE  = MOCK_RECIPIENTS.reduce((s, r) => s + r.rate, 0);
const DEPOSIT     = 2.0; // sBTC

const DEMO_STREAM_ID = "demo";
const DEMO_NAME      = "Open-Source Contributor Payroll";
const DEMO_TOKEN     = "sBTC";

/** Linear interpolation — visually the number ticks up every second */
function useTickingValue(baseValue: number, ratePerBlock: number): number {
  const [value, setValue] = useState(baseValue);
  const startRef = useRef<{ time: number; base: number }>({ time: Date.now(), base: baseValue });

  useEffect(() => {
    startRef.current = { time: Date.now(), base: baseValue };
    setValue(baseValue);
  }, [baseValue]);

  useEffect(() => {
    const t = setInterval(() => {
      const elapsed = (Date.now() - startRef.current.time) / 1000;
      const gain = (elapsed * ratePerBlock) / 600; // 600s per block avg
      setValue(startRef.current.base + gain);
    }, 200);
    return () => clearInterval(t);
  }, [ratePerBlock]);

  return value;
}

export default function DemoPage() {
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  // Fake running time in blocks (1 "demo block" = 3 seconds for visual drama)
  useEffect(() => {
    const t = setInterval(
      () => setElapsed((Date.now() - startTime.current) / 3000),
      200
    );
    return () => clearInterval(t);
  }, []);

  // Each recipient accrues: rate * elapsed_blocks
  const totalAccrued = MOCK_RECIPIENTS.reduce(
    (s, r) => s + r.rate * elapsed,
    0
  );
  const remaining    = Math.max(0, DEPOSIT - totalAccrued);
  const claimablePct = totalAccrued / DEPOSIT;

  // Per-recipient live claimable
  const liveRates = MOCK_RECIPIENTS.map((r) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useTickingValue(r.rate * elapsed, r.rate)
  );

  return (
    <div className="max-w-xl mx-auto pt-10 flex flex-col gap-6">
      {/* Demo banner */}
      <div className="rounded-lg border border-orange-800/50 bg-orange-900/20 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-orange-300">
          ✦ Interactive demo — no wallet needed. Data is simulated.
        </span>
        <Link href="/" className="text-xs text-orange-400 hover:text-orange-300 underline">
          Back to home
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{DEMO_NAME}</h1>

      {/* Stream overview */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        <Row label="Status"      value="Active" highlight="green" />
        <Row label="Token"       value="sBTC — real Bitcoin on Stacks" />
        <Row label="Deposit"     value={`${DEPOSIT.toFixed(8)} sBTC`} />
        <Row label="Total rate"  value={`${TOTAL_RATE.toFixed(8)} sBTC / block`} />
        <Row label="Recipients"  value={MOCK_RECIPIENTS.length.toString()} />

        {/* Live remaining bar */}
        <div className="border-t border-neutral-800 pt-3 mt-1">
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span>Stream balance</span>
            <span className="text-orange-300 font-mono">{remaining.toFixed(8)} sBTC remaining</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-200"
              style={{ width: `${Math.max(0, 100 - claimablePct * 100).toFixed(2)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recipients with live claimable */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-0 text-sm">
        <p className="text-neutral-500 text-xs mb-3">Recipients — funds accruing in real time ↓</p>
        {MOCK_RECIPIENTS.map((r, i) => (
          <div key={r.address} className="flex items-center justify-between py-2.5 border-b border-neutral-800 last:border-0 gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-orange-400 text-xs font-semibold">{r.label}</span>
              <span className="font-mono text-xs text-neutral-600 truncate">{r.address.slice(0, 16)}…</span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-neutral-500">{r.rate.toFixed(8)} sBTC/block</div>
              <div className="font-mono text-green-400 text-sm">
                {liveRates[i].toFixed(8)} sBTC
              </div>
              <div className="text-xs text-neutral-600">accrued</div>
            </div>
          </div>
        ))}
      </div>

      {/* Simulated withdraw button */}
      <button
        disabled
        className="py-2.5 rounded bg-orange-500/50 text-white/70 font-medium cursor-not-allowed"
        title="Connect a real wallet to withdraw"
      >
        Withdraw Accrued sBTC (connect wallet to use)
      </button>

      {/* CTA */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        <p className="font-semibold text-base">Ready to stream real sBTC?</p>
        <p className="text-neutral-400 text-sm">
          Connect your Hiro Wallet to create a real stream on Stacks testnet. Deposit sBTC,
          set per-recipient rates, and let the blockchain do the rest.
        </p>
        <Link
          href="/"
          className="mt-1 inline-block px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium text-center transition-colors"
        >
          Connect Wallet → Start Streaming
        </Link>
        <p className="text-xs text-neutral-600">
          Runs on Stacks testnet · Bitcoin finality · No bridges or wrapping
        </p>
      </div>

      <p className="text-xs text-neutral-700 text-center">
        Demo blocks tick at 3s for visualization · Real Stacks blocks ≈ 10 min
      </p>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "green" }) {
  const valueClass = highlight === "green" ? "text-green-400" : "text-neutral-200";
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className={`${valueClass} text-right`}>{value}</span>
    </div>
  );
}
