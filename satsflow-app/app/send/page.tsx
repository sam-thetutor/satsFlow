"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useCreateStream } from "@/lib/hooks/useTransactions";
import { SUPPORTED_TOKENS, TokenKey } from "@/lib/contract";

interface RecipientEntry {
  address: string;
  rate: string;
}

export default function SendPage() {
  const { connected, address, connect } = useWallet();
  const createStream = useCreateStream();

  const [entries, setEntries]         = useState<RecipientEntry[]>([{ address: "", rate: "" }]);
  const [token, setToken]             = useState<TokenKey>("STX");
  const [deposit, setDeposit]         = useState("");
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [txId, setTxId]               = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

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

  return (
    <div className="max-w-lg mx-auto pt-10">
      <h1 className="text-2xl font-bold mb-6">Create Payment Stream</h1>

      {txId ? (
        <div className="rounded-xl border border-green-700 bg-neutral-900 p-6 text-center">
          <p className="text-green-400 font-semibold mb-2">Stream created!</p>
          <p className="text-xs font-mono text-neutral-400 break-all">{txId}</p>
          <a
            href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-orange-400 underline"
          >
            View on Explorer
          </a>
        </div>
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
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>

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
