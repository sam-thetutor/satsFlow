"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useCreateStream, useCreateStreamWithYield } from "@/lib/hooks/useTransactions";
import { SUPPORTED_TOKENS, TokenKey } from "@/lib/contract";

interface RecipientEntry {
  address: string;
  rate: string;
}

export default function SendPage() {
  const { connected, address, connect } = useWallet();
  const createStream = useCreateStream();
  const createStreamWithYield = useCreateStreamWithYield();

  const [entries, setEntries]         = useState<RecipientEntry[]>([{ address: "", rate: "" }]);
  const [token, setToken]             = useState<TokenKey>("sBTC");
  const [deposit, setDeposit]         = useState("");
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [txId, setTxId]               = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [enableYield, setEnableYield] = useState(false);
  // reserveRatioPct: % kept as liquid reserve (default 50%). LP allocation = 100 - reserveRatioPct.
  const [reserveRatioPct, setReserveRatioPct] = useState(50);

  // Yield requires sBTC
  useEffect(() => { if (enableYield) setToken("sBTC"); }, [enableYield]);

  const micro = token === "STX" ? 1_000_000 : 100_000_000;

  function toMicro(val: string): bigint {
    const n = parseFloat(val);
    return isNaN(n) ? 0n : BigInt(Math.round(n * micro));
  }

  const totalRateMicro = entries.reduce((sum, e) => {
    const r = toMicro(e.rate);
    return r > 0n ? sum + r : sum;
  }, 0n);

  const depositMicro = toMicro(deposit);

  const durationBlocks =
    totalRateMicro > 0n && depositMicro > 0n && depositMicro % totalRateMicro === 0n
      ? depositMicro / totalRateMicro
      : null;

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-neutral-400">Connect your wallet to create a stream.</p>
        <button onClick={connect} className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
          Connect Wallet
        </button>
      </div>
    );
  }

  function updateEntry(i: number, field: keyof RecipientEntry, value: string) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }

  function addEntry() {
    if (entries.length < 10) setEntries((prev) => [...prev, { address: "", rate: "" }]);
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTxId(null);

    if (depositMicro <= 0n) {
      setError("Deposit must be a positive number.");
      return;
    }

    const trimmed = entries.map((e) => ({ ...e, address: e.address.trim() }));

    if (trimmed.some((e) => !e.address.startsWith("S") || e.address.length < 30)) {
      setError("All addresses must be valid Stacks principals.");
      return;
    }
    if (trimmed.some((e) => e.address === address)) {
      setError("Recipient list cannot include your own address.");
      return;
    }
    if (new Set(trimmed.map((e) => e.address)).size !== trimmed.length) {
      setError("Recipient list cannot contain duplicates.");
      return;
    }

    const rateMicros = trimmed.map((e) => toMicro(e.rate));
    if (rateMicros.some((r) => r <= 0n)) {
      setError("Each recipient must have a rate greater than zero.");
      return;
    }
    if (totalRateMicro <= 0n) {
      setError("Total rate must be greater than zero.");
      return;
    }
    if (depositMicro % totalRateMicro !== 0n) {
      setError(
        `Deposit must divide evenly by the total rate. Try a deposit that is a multiple of ${Number(totalRateMicro) / micro} ${token}.`
      );
      return;
    }

    if (enableYield && token === "sBTC") {
      createStreamWithYield(
        trimmed.map((e, i) => ({ recipient: e.address, rate: rateMicros[i] })),
        depositMicro,
        name,
        description,
        reserveRatioPct * 100, // convert % to bps
        (id) => setTxId(id),
        () => setError("Transaction cancelled.")
      );
    } else {
      createStream(
        trimmed.map((e, i) => ({ recipient: e.address, rate: rateMicros[i] })),
        token,
        depositMicro,
        name,
        description,
        (id) => setTxId(id),
        () => setError("Transaction cancelled.")
      );
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-10">
      <h1 className="text-2xl font-bold mb-6">Create Payment Stream</h1>

      {txId ? (
        <SuccessScreen txId={txId} token={token} name={name} recipientCount={entries.length} deposit={deposit} enableYield={enableYield} onReset={() => { setTxId(null); setName(""); setDescription(""); setDeposit(""); setEntries([{ address: "", rate: "" }]); setEnableYield(false); }} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          <label className="flex flex-col gap-1 text-sm">
            Token
            <select
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              value={token}
              onChange={(e) => setToken(e.target.value as TokenKey)}
            >
              {(Object.keys(SUPPORTED_TOKENS) as TokenKey[]).map((k) => (
                <option key={k} value={k}>{k}{k === "sBTC" ? " — real Bitcoin on Stacks" : " — Stacks native token"}</option>
              ))}
            </select>
            {token === "sBTC" && (
              <span className="text-xs text-orange-400 mt-1">
                ✦ Streaming real Bitcoin — backed by Bitcoin L1 finality via Stacks
              </span>
            )}
          </label>

          {/* Yield farming toggle */}
          {token === "sBTC" && (
            <button
              type="button"
              onClick={() => setEnableYield((v) => !v)}
              className={`flex items-center gap-3 text-left rounded-xl border p-4 transition-colors ${
                enableYield
                  ? "border-orange-700/60 bg-orange-900/15"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
              }`}
            >
              <div className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${enableYield ? "bg-orange-500" : "bg-neutral-700"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enableYield ? "translate-x-5" : ""}`} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Enable yield farming</span>
                <span className="text-xs text-neutral-500">Deposit earns Bitflow LP fees while streaming — your sBTC works while it streams</span>
              </div>
            </button>
          )}

          {/* Yield config panel */}
          {enableYield && token === "sBTC" && (
            <div className="flex flex-col gap-3 rounded-xl border border-orange-800/40 bg-orange-900/10 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-orange-300 text-xs uppercase tracking-wide">Bitflow sBTC-STX Pool</span>
                <span className="text-xs text-neutral-500">~5–15% LP APY</span>
              </div>
              <label className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">LP allocation</span>
                  <span className="font-mono text-orange-300">
                    {100 - reserveRatioPct}% to LP · {reserveRatioPct}% liquid reserve
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={100 - reserveRatioPct}
                  onChange={(e) => setReserveRatioPct(100 - parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>10% to LP</span>
                  <span>90% to LP</span>
                </div>
              </label>
              {depositMicro > 0n && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-neutral-800/60 px-3 py-2">
                    <div className="text-neutral-500 mb-0.5">Deployed to Bitflow</div>
                    <div className="font-mono text-orange-300">
                      {((Number(depositMicro) / 1e8) * (100 - reserveRatioPct) / 100).toFixed(8)} sBTC
                    </div>
                  </div>
                  <div className="rounded-lg bg-neutral-800/60 px-3 py-2">
                    <div className="text-neutral-500 mb-0.5">Liquid reserve</div>
                    <div className="font-mono text-neutral-300">
                      {((Number(depositMicro) / 1e8) * reserveRatioPct / 100).toFixed(8)} sBTC
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Stream name
            <input
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              placeholder="e.g. Design sprint payouts"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 64))}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Description
            <textarea
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-orange-500 min-h-16"
              placeholder="What this stream is for"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 256))}
            />
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Recipients</span>
              <span className="text-xs text-neutral-500">rate per block ({token})</span>
            </div>
            {entries.map((entry, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="flex-1 min-w-0 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-500"
                  placeholder="ST..."
                  value={entry.address}
                  onChange={(e) => updateEntry(i, "address", e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="w-28 shrink-0 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                  placeholder="0.01"
                  value={entry.rate}
                  onChange={(e) => updateEntry(i, "rate", e.target.value)}
                  required
                />
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(i)}
                    className="shrink-0 text-neutral-500 hover:text-red-400 transition-colors px-1 text-xl leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {entries.length < 10 && (
              <button
                type="button"
                onClick={addEntry}
                className="text-sm text-orange-400 hover:text-orange-300 text-left transition-colors"
              >
                + Add recipient
              </button>
            )}
            {totalRateMicro > 0n && (
              <p className="text-xs text-neutral-500">
                Total rate: {(Number(totalRateMicro) / micro).toFixed(token === "STX" ? 6 : 8)} {token}/block
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            Total deposit ({token})
            <input
              type="number"
              min="0"
              step="any"
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              placeholder="e.g. 10"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              required
            />
            {durationBlocks !== null && (
              <span className="text-xs text-neutral-500">
                ≈ {durationBlocks.toString()} blocks at current rates
              </span>
            )}
          </label>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <p className="text-xs text-neutral-500">
            Wallet safety: this transaction is guarded with post-conditions and can send at most the deposit amount you set.
          </p>

          <button
            type="submit"
            className="mt-2 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors"
          >
            Create Stream
          </button>
        </form>
      )}
    </div>
  );
}

function SuccessScreen({
  txId,
  token,
  name,
  recipientCount,
  deposit,
  enableYield,
  onReset,
}: {
  txId: string;
  token: TokenKey;
  name: string;
  recipientCount: number;
  deposit: string;
  enableYield: boolean;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyTx() {
    navigator.clipboard.writeText(txId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-green-700 bg-neutral-900 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-green-400 font-semibold text-lg">Stream submitted!</p>
            <p className="text-neutral-400 text-sm">Transaction broadcast to Stacks mainnet</p>
          </div>
        </div>

        <div className="rounded-lg bg-neutral-800 p-3 flex flex-col gap-1.5 text-sm">
          {name && <div className="flex justify-between"><span className="text-neutral-500">Name</span><span className="text-neutral-200">{name}</span></div>}
          <div className="flex justify-between"><span className="text-neutral-500">Token</span><span className="text-neutral-200">{token}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Deposit</span><span className="text-neutral-200">{deposit} {token}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Recipients</span><span className="text-neutral-200">{recipientCount}</span></div>
          {enableYield && <div className="flex justify-between"><span className="text-neutral-500">Yield</span><span className="text-orange-400 font-medium">Bitflow LP ✦</span></div>}
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <p className="text-neutral-500 text-xs">Transaction ID</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-neutral-400 break-all flex-1">{txId}</span>
            <button
              onClick={copyTx}
              className="shrink-0 text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <a
            href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-orange-400 underline"
          >
            View on Stacks Explorer ↗
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-sm flex flex-col gap-3">
        <p className="font-semibold">What&apos;s next?</p>
        <p className="text-neutral-400 text-sm">
          Once the transaction confirms (next Stacks block), your stream will
          appear in <strong className="text-neutral-200">My Streams</strong>. From there,
          copy the recipient link and share it with each payee.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/send/dashboard"
            className="px-4 py-2 rounded bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors"
          >
            Go to My Streams →
          </Link>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 text-sm transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    </div>
  );
}
