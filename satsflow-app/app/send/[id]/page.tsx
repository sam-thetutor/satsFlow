"use client";

import { use, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useStream, useStreamRecipients, useRecipientStates } from "@/lib/hooks/useStreams";
import { useTopUpStream, useCancelStream } from "@/lib/hooks/useTransactions";
import { formatTokenAmount, tokenKeyFromPrincipal, TokenKey } from "@/lib/contract";

export default function SenderStreamDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const streamId = parseInt(id, 10);
  const { address } = useWallet();
  const { stream, loading, error, refetch } = useStream(streamId, address);
  const recipients = useStreamRecipients(streamId, address);
  const recipientStates = useRecipientStates(streamId, address, recipients);
  const topUp  = useTopUpStream();
  const cancel = useCancelStream();

  const [topUpAmount, setTopUpAmount] = useState("");
  const [txId,  setTxId]  = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  if (loading) return <p className="text-neutral-400 pt-10 text-center">Loading...</p>;
  if (error)   return <p className="text-red-400 pt-10 text-center">{error}</p>;
  if (!stream) return <p className="text-neutral-400 pt-10 text-center">Stream not found.</p>;

  const tokenKey = tokenKeyFromPrincipal(stream.token) ?? "STX";
  const remaining = stream.deposit - stream.total_withdrawn;

  function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    setTxErr(null);
    const amount = BigInt(Math.round(parseFloat(topUpAmount) * (tokenKey === "STX" ? 1_000_000 : 100_000_000)));
    topUp(streamId, tokenKey as TokenKey, amount, (id) => { setTxId(id); refetch(); }, () => setTxErr("Cancelled."));
  }

  function handleCancel() {
    setTxErr(null);
    cancel(streamId, (id) => { setTxId(id); refetch(); }, () => setTxErr("Cancelled."));
  }

  return (
    <div className="max-w-lg mx-auto pt-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Stream #{streamId}</h1>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        {stream.name && <Row label="Name" value={stream.name} />}
        {stream.description && <Row label="Description" value={stream.description} />}
        <Row label="Status"     value={stream.is_active ? "Active" : "Inactive"} highlight={stream.is_active ? "green" : "red"} />
        <Row label="Token"      value={tokenKey} />
        <Row label="Deposit"    value={formatTokenAmount(stream.deposit, tokenKey)} />
        <Row label="Withdrawn"  value={formatTokenAmount(stream.total_withdrawn, tokenKey)} />
        <Row label="Remaining"  value={formatTokenAmount(remaining, tokenKey)} />
        <Row label="Total rate/block" value={formatTokenAmount(stream.rate_per_second, tokenKey)} />

        <div className="border-t border-neutral-800 pt-3 mt-1">
          <p className="text-neutral-500 mb-2">Recipients ({stream.recipient_count.toString()})</p>
          {recipients.length === 0 && <p className="text-xs text-neutral-600">Loading...</p>}
          {recipients.map((addr) => {
            const state = recipientStates.find((s) => s.address === addr);
            return (
              <div key={addr} className="flex items-center justify-between gap-3 py-1.5 border-b border-neutral-800 last:border-0">
                <span className="font-mono text-xs text-neutral-400 truncate">{addr}</span>
                <span className="text-xs text-neutral-300 shrink-0">
                  {state ? formatTokenAmount(state.rate_per_second, tokenKey) + "/block" : "…"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {stream.is_active && (
        <>
          <form onSubmit={handleTopUp} className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              placeholder={`Top-up amount (${tokenKey})`}
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              required
            />
            <button type="submit" className="px-4 py-2 rounded bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors">
              Top Up
            </button>
          </form>

          <button
            onClick={handleCancel}
            className="py-2 rounded border border-red-700 text-red-400 hover:bg-red-900/30 text-sm font-medium transition-colors"
          >
            Cancel Stream
          </button>
        </>
      )}

      {txId  && <p className="text-green-400 text-sm font-mono break-all">Tx: {txId}</p>}
      {txErr && <p className="text-red-400 text-sm">{txErr}</p>}
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: "green" | "red" }) {
  const valueClass = highlight === "green" ? "text-green-400" : highlight === "red" ? "text-red-400" : "text-neutral-200";
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${valueClass} text-right break-all`}>{value}</span>
    </div>
  );
}
