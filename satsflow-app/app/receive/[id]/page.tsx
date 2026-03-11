"use client";

import { use, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useStream, useClaimable, useRecipientStates } from "@/lib/hooks/useStreams";
import { useWithdraw } from "@/lib/hooks/useTransactions";
import { formatTokenAmount, tokenKeyFromPrincipal } from "@/lib/contract";

export default function RecipientStreamDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const streamId = parseInt(id, 10);
  const { address } = useWallet();
  const { stream, loading, error, refetch } = useStream(streamId, address);
  const recipientStates = useRecipientStates(streamId, address, address ? [address] : []);
  const claimable = useClaimable(streamId, address);
  const withdraw  = useWithdraw();

  const [txId,  setTxId]  = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);

  if (loading) return <p className="text-neutral-400 pt-10 text-center">Loading...</p>;
  if (error)   return <p className="text-red-400 pt-10 text-center">{error}</p>;
  if (!stream) return <p className="text-neutral-400 pt-10 text-center">Stream not found.</p>;

  const tokenKey = tokenKeyFromPrincipal(stream.token) ?? "STX";
  const myState = recipientStates.find((s) => s.address === address);
  const myRemaining = myState ? myState.allocation - myState.total_withdrawn : null;

  function handleWithdraw() {
    setTxErr(null);
    withdraw(streamId, (id) => { setTxId(id); refetch(); }, () => setTxErr("Cancelled."));
  }

  return (
    <div className="max-w-lg mx-auto pt-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Stream #{streamId}</h1>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        {stream.name && <Row label="Name" value={stream.name} />}
        {stream.description && <Row label="Description" value={stream.description} />}
        <Row label="Status"    value={stream.is_active ? "Active" : "Inactive"} highlight={stream.is_active ? "green" : "red"} />
        <Row label="From"      value={stream.sender} mono />
        <Row label="Your address" value={address ?? "-"} mono />
        <Row label="Token"     value={tokenKey} />
        <Row
          label="Your rate/block"
          value={myState ? formatTokenAmount(myState.rate_per_second, tokenKey) : "Loading..."}
        />
        <Row
          label="Your withdrawn"
          value={myState ? formatTokenAmount(myState.total_withdrawn, tokenKey) : "Loading..."}
        />
        <Row
          label="Your allocation"
          value={myState ? formatTokenAmount(myState.allocation, tokenKey) : "Loading..."}
        />
        <Row
          label="Your remaining"
          value={myRemaining !== null ? formatTokenAmount(myRemaining, tokenKey) : "Loading..."}
        />
        {claimable !== null && (
          <Row label="Claimable now" value={formatTokenAmount(claimable, tokenKey)} highlight="green" />
        )}
      </div>

      {stream.is_active && (
        <button
          onClick={handleWithdraw}
          className="py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors"
        >
          Withdraw Accrued Funds
        </button>
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
