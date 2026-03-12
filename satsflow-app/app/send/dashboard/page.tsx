"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useSenderStreams, useStream } from "@/lib/hooks/useStreams";
import { formatTokenAmount, tokenKeyFromPrincipal, TokenKey } from "@/lib/contract";
import { Stream } from "@/lib/types";

// ---- Status badge logic ----
function streamStatus(stream: Stream): { label: string; color: string } {
  if (stream.is_active) return { label: "Active", color: "bg-green-900 text-green-300" };
  const remaining = stream.deposit - stream.total_withdrawn;
  if (remaining === 0n) return { label: "Depleted", color: "bg-yellow-900/60 text-yellow-300" };
  return { label: "Cancelled", color: "bg-red-900/50 text-red-400" };
}

// ---- Skeleton card ----
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-neutral-800 rounded w-32" />
        <div className="h-5 bg-neutral-800 rounded-full w-16" />
      </div>
      <div className="h-3 bg-neutral-800 rounded w-48 mb-2" />
      <div className="h-3 bg-neutral-800 rounded w-24" />
    </div>
  );
}

// ---- Aggregated stats banner ----
function StatsBanner({ ids, address }: { ids: number[]; address: string }) {
  // We'll just show the total stream count and a helpful message.
  // Full aggregation would require lifting stream state — out of scope here.
  const total = ids.length;
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <StatCard label="Total streams" value={total.toString()} />
      <StatCard label="Status" value={total === 0 ? "—" : "Loading…"} sub="active count" />
      <StatCard label="Network" value="Mainnet" />
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-center">
      <div className="text-lg font-bold text-orange-400">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
      {sub && <div className="text-xs text-neutral-700">{sub}</div>}
    </div>
  );
}

// ---- Stats banner that aggregates once all cards have loaded ----
function LiveStatsBanner({ ids, address }: { ids: number[]; address: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-3 mb-6 flex items-center justify-between text-sm">
      <div className="flex gap-6">
        <span className="text-neutral-400">
          <span className="text-white font-semibold">{ids.length}</span> stream{ids.length !== 1 ? "s" : ""}
        </span>
      </div>
      <Link href="/send" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
        + New Stream
      </Link>
    </div>
  );
}

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
        <h1 className="text-2xl font-bold">My Streams</h1>
        <Link href="/send" className="px-4 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium transition-colors">
          + New Stream
        </Link>
      </div>

      {!loading && ids.length > 0 && (
        <LiveStatsBanner ids={ids} address={address!} />
      )}

      {/* Skeleton while loading */}
      {loading && (
        <div className="flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && ids.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center rounded-xl border border-dashed border-neutral-800">
          <span className="text-4xl">💸</span>
          <p className="font-semibold text-neutral-300">No streams yet</p>
          <p className="text-neutral-500 text-sm max-w-xs">
            Create your first payment stream to start streaming sBTC or STX to your team.
          </p>
          <Link href="/send" className="px-5 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium text-sm transition-colors">
            Create First Stream
          </Link>
        </div>
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
  if (loading) return <SkeletonCard />;
  if (!stream)  return null;

  const tokenKey  = tokenKeyFromPrincipal(stream.token) ?? "STX";
  const remaining = stream.deposit - stream.total_withdrawn;
  const status    = streamStatus(stream);
  const drainPct  = stream.deposit > 0n
    ? Number((stream.total_withdrawn * 100n) / stream.deposit)
    : 0;

  return (
    <Link href={`/send/${streamId}`}>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-600 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-sm font-semibold group-hover:text-white transition-colors">
              {stream.name || `Stream #${streamId}`}
            </span>
            <p className="text-xs text-neutral-600 mt-0.5">#{streamId}</p>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Drain progress bar */}
        {stream.deposit > 0n && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${drainPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">
            {stream.recipient_count.toString()} recipient{stream.recipient_count !== 1n ? "s" : ""}
            {" · "}
            {formatTokenAmount(stream.rate_per_second, tokenKey as TokenKey)}/block
          </span>
          <span className="text-neutral-400 font-mono">
            {formatTokenAmount(remaining, tokenKey as TokenKey)} left
          </span>
        </div>
      </div>
    </Link>
  );
}
