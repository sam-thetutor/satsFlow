"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useRecipientStreams, useStream, useClaimable, useRecipientStates, useMultiClaimable } from "@/lib/hooks/useStreams";
import { useWithdraw } from "@/lib/hooks/useTransactions";
import { formatTokenAmount, tokenKeyFromPrincipal, TokenKey } from "@/lib/contract";

// ---- Skeleton ----
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-neutral-800 rounded w-36" />
        <div className="h-5 bg-neutral-800 rounded-full w-14" />
      </div>
      <div className="h-3 bg-neutral-800 rounded w-52 mb-2" />
      <div className="h-3 bg-neutral-800 rounded w-24" />
    </div>
  );
}

// ---- Stats banner ----
function StatsBanner({ ids, address }: { ids: number[]; address: string }) {
  const claimables = useMultiClaimable(ids, address);
  const totalClaimable = Object.values(claimables).reduce((s, v) => s + v, 0n);

  // We need a stream to get the token — simplify: assume STX for display or just show raw micro
  // For a hackathon, show count + message
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-3 mb-6 flex items-center justify-between text-sm">
      <div className="flex gap-6">
        <span className="text-neutral-400">
          <span className="text-white font-semibold">{ids.length}</span> stream{ids.length !== 1 ? "s" : ""}
        </span>
        {totalClaimable > 0n && (
          <span className="text-green-400 font-semibold text-xs">
            {(Number(totalClaimable) / 1_000_000).toFixed(6)} STX claimable
          </span>
        )}
      </div>
    </div>
  );
}

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

      {!loading && ids.length > 0 && (
        <StatsBanner ids={ids} address={address!} />
      )}

      {/* Skeletons while loading */}
      {loading && (
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && ids.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center rounded-xl border border-dashed border-neutral-800">
          <span className="text-4xl">📬</span>
          <p className="font-semibold text-neutral-300">No incoming streams</p>
          <p className="text-neutral-500 text-sm max-w-xs">
            Ask a sender to create a stream and share the recipient link with you.
          </p>

        </div>
      )}

      <div className="flex flex-col gap-4">
        {ids.map((id) => (
          <RecipientStreamCard key={id} streamId={id} recipientAddress={address!} />
        ))}
      </div>
    </div>
  );
}

function RecipientStreamCard({
  streamId,
  recipientAddress,
}: {
  streamId: number;
  recipientAddress: string;
}) {
  const { stream, loading } = useStream(streamId, recipientAddress);
  const claimable = useClaimable(streamId, recipientAddress);
  const recipientStates = useRecipientStates(streamId, recipientAddress, [recipientAddress]);
  const myState = recipientStates[0];
  const withdraw = useWithdraw();

  const [txId, setTxId] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  if (loading) return <SkeletonCard />;
  if (!stream)  return null;

  const tokenKey = tokenKeyFromPrincipal(stream.token) ?? "STX";

  function handleClaim(e: React.MouseEvent) {
    e.preventDefault();
    if (claiming) return;
    setClaiming(true);
    withdraw(
      streamId,
      (id) => { setTxId(id); setClaiming(false); },
      () => setClaiming(false)
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 transition-colors">
      <Link href={`/receive/${streamId}`} className="block">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-sm font-semibold">
              {stream.name || `Stream #${streamId}`}
            </span>
            <p className="text-xs text-neutral-600 mt-0.5">#{streamId}</p>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${stream.is_active ? "bg-green-900 text-green-300" : "bg-neutral-800 text-neutral-500"}`}>
            {stream.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <p className="text-xs text-neutral-500 font-mono truncate mb-1">
          From: {stream.sender.slice(0, 14)}…{stream.sender.slice(-4)}
        </p>

        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            {myState
              ? `${formatTokenAmount(myState.rate_per_second, tokenKey as TokenKey)}/block`
              : `${formatTokenAmount(stream.rate_per_second, tokenKey as TokenKey)}/block (total)`}
          </span>
          {claimable !== null && claimable > 0n && (
            <span className="text-green-400 font-semibold">
              {formatTokenAmount(claimable, tokenKey as TokenKey)} claimable
            </span>
          )}
        </div>
      </Link>

      {/* Claim button */}
      {stream.is_active && claimable !== null && claimable > 0n && (
        <div className="mt-3 pt-3 border-t border-neutral-800">
          {txId ? (
            <a
              href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 underline"
            >
              Tx submitted → View on Explorer
            </a>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-1.5 rounded bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {claiming ? "Opening wallet…" : `Claim ${formatTokenAmount(claimable, tokenKey as TokenKey)}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
