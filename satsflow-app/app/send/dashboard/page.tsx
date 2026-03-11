"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useSenderStreams, useStream } from "@/lib/hooks/useStreams";
import { formatTokenAmount, tokenKeyFromPrincipal } from "@/lib/contract";

export default function SendDashboard() {
  const { connected, address, connect } = useWallet();
  const { ids, loading } = useSenderStreams(address);

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-neutral-400">Connect your wallet to view your streams.</p>
        <button onClick={connect} className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pt-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Streams</h1>
        <Link href="/send" className="px-4 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors">
          + New Stream
        </Link>
      </div>
      {loading && <p className="text-neutral-400">Loading...</p>}
      {!loading && ids.length === 0 && (
        <p className="text-neutral-500">You have not created any streams yet.</p>
      )}
      <div className="flex flex-col gap-4">
        {ids.map((id) => (
          <SenderStreamCard key={id} streamId={id} senderAddress={address!} />
        ))}
      </div>
    </div>
  );
}

function SenderStreamCard({ streamId, senderAddress }: { streamId: number; senderAddress: string }) {
  const { stream, loading } = useStream(streamId, senderAddress);
  if (loading || !stream) return null;

  const tokenKey = tokenKeyFromPrincipal(stream.token) ?? "STX";
  const remaining = stream.deposit - stream.total_withdrawn;

  return (
    <Link href={`/send/${streamId}`}>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-600 transition-colors cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">{stream.name || `Stream #${streamId}`}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${stream.is_active ? "bg-green-900 text-green-300" : "bg-neutral-800 text-neutral-500"}`}>
            {stream.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-neutral-500 font-mono truncate max-w-[55%]">
            Recipients: {stream.recipient_count.toString()}
          </p>
          <p className="text-xs text-neutral-400">{formatTokenAmount(remaining, tokenKey)} left</p>
        </div>
        <p className="text-xs text-neutral-600 mt-1.5">{formatTokenAmount(stream.rate_per_second, tokenKey)}/block</p>
      </div>
    </Link>
  );
}
