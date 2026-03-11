"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useRecipientStreams, useStream } from "@/lib/hooks/useStreams";
import { formatTokenAmount, tokenKeyFromPrincipal } from "@/lib/contract";

export default function ReceivePage() {
  const { connected, address, connect } = useWallet();
  const { ids, loading } = useRecipientStreams(address);

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-neutral-400">Connect your wallet to view incoming streams.</p>
        <button onClick={connect} className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-10">
      <h1 className="text-2xl font-bold mb-6">Incoming Streams</h1>
      {loading && <p className="text-neutral-400">Loading...</p>}
      {!loading && ids.length === 0 && (
        <p className="text-neutral-500">No incoming streams yet.</p>
      )}
      <div className="flex flex-col gap-4">
        {ids.map((id) => (
          <RecipientStreamCard key={id} streamId={id} recipientAddress={address!} />
        ))}
      </div>
    </div>
  );
}

function RecipientStreamCard({ streamId, recipientAddress }: { streamId: number; recipientAddress: string }) {
  const { stream, loading } = useStream(streamId, recipientAddress);
  if (loading || !stream) return null;

  const tokenKey = tokenKeyFromPrincipal(stream.token) ?? "STX";

  return (
    <Link href={`/receive/${streamId}`}>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-600 transition-colors cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{stream.name || `Stream #${streamId}`}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${stream.is_active ? "bg-green-900 text-green-300" : "bg-neutral-800 text-neutral-500"}`}>
            {stream.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-neutral-500 font-mono truncate max-w-[65%]">From: {stream.sender}</p>
          <p className="text-xs text-neutral-400">{formatTokenAmount(stream.rate_per_second, tokenKey)}/block</p>
        </div>
      </div>
    </Link>
  );
}
