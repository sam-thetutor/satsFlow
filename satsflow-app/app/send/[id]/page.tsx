"use client";

import { use, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useStream, useStreamRecipients, useRecipientStates, useBnsName } from "@/lib/hooks/useStreams";
import { useTopUpStream, useCancelStream } from "@/lib/hooks/useTransactions";
import { formatTokenAmount, tokenKeyFromPrincipal, TokenKey } from "@/lib/contract";
import { Stream } from "@/lib/types";

// QR image via public API (no extra dependency)
function QRImage({ url }: { url: string }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}&bgcolor=171717&color=e5e5e5`}
      alt="QR Code"
      width={140}
      height={140}
      className="rounded"
    />
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="text-xs px-2.5 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors shrink-0"
    >
      {copied ? "Copied!" : label ?? "Copy"}
    </button>
  );
}

function StatusBadge({ stream }: { stream: Stream }) {
  if (stream.is_active) return <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-900 text-green-300 font-medium">Active</span>;
  const remaining = stream.deposit - stream.total_withdrawn;
  if (remaining === 0n) return <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-900/60 text-yellow-300 font-medium">Depleted</span>;
  return <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-900/50 text-red-400 font-medium">Cancelled</span>;
}

function RecipientRow({ addr, state, tokenKey }: {
  addr: string;
  state: { rate_per_second: bigint; total_withdrawn: bigint; allocation: bigint } | undefined;
  tokenKey: TokenKey;
}) {
  const bnsName = useBnsName(addr);
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-neutral-800 last:border-0">
      <div className="flex flex-col min-w-0">
        {bnsName && <span className="text-orange-400 text-xs">{bnsName}</span>}
        <span className="font-mono text-xs text-neutral-400 truncate">{addr.slice(0, 12)}…{addr.slice(-4)}</span>
      </div>
      <span className="text-xs text-neutral-300 shrink-0">
        {state ? formatTokenAmount(state.rate_per_second, tokenKey) + "/block" : "…"}
      </span>
    </div>
  );
}

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
  const [showQr, setShowQr] = useState(false);

  if (loading) return (
    <div className="max-w-lg mx-auto pt-10 flex flex-col gap-4 animate-pulse">
      <div className="h-7 bg-neutral-800 rounded w-40" />
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-neutral-800 rounded" />
        ))}
      </div>
    </div>
  );
  if (error)   return <p className="text-red-400 pt-10 text-center">{error}</p>;
  if (!stream) return <p className="text-neutral-400 pt-10 text-center">Stream not found.</p>;

  const tokenKey        = tokenKeyFromPrincipal(stream.token) ?? "STX";
  const remaining       = stream.deposit - stream.total_withdrawn;
  const drainPct        = stream.deposit > 0n ? Number((stream.total_withdrawn * 100n) / stream.deposit) : 0;
  const recipientLink   = typeof window !== "undefined"
    ? `${window.location.origin}/receive/${streamId}`
    : `/receive/${streamId}`;

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{stream.name || `Stream #${streamId}`}</h1>
        <StatusBadge stream={stream} />
      </div>

      {/* Main info card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        {stream.description && <Row label="Description" value={stream.description} />}
        <Row label="Stream ID"  value={`#${streamId}`} />
        <Row label="Token"      value={tokenKey} />
        <Row label="Deposit"    value={formatTokenAmount(stream.deposit, tokenKey)} />
        <Row label="Withdrawn"  value={formatTokenAmount(stream.total_withdrawn, tokenKey)} />
        <Row label="Remaining"  value={formatTokenAmount(remaining, tokenKey)} highlight={remaining === 0n ? "red" : undefined} />
        <Row label="Total rate/block" value={formatTokenAmount(stream.rate_per_second, tokenKey)} />

        {/* Drain progress bar */}
        {stream.deposit > 0n && (
          <div className="pt-1">
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${drainPct}%` }}
              />
            </div>
            <p className="text-xs text-neutral-600 mt-1">{drainPct.toFixed(1)}% disbursed</p>
          </div>
        )}

        {/* Recipients */}
        <div className="border-t border-neutral-800 pt-3 mt-1">
          <p className="text-neutral-500 mb-2">
            Recipients ({stream.recipient_count.toString()})
          </p>
          {recipients.length === 0 && <p className="text-xs text-neutral-600">Loading…</p>}
          {recipients.map((addr) => (
            <RecipientRow
              key={addr}
              addr={addr}
              state={recipientStates.find((s) => s.address === addr)}
              tokenKey={tokenKey as TokenKey}
            />
          ))}
        </div>
      </div>

      {/* Share link */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        <p className="font-semibold">Share with recipients</p>
        <p className="text-neutral-500 text-xs">
          Send this link to each payee — they open it after connecting their wallet.
        </p>
        <div className="flex items-center gap-2">
          <span className="flex-1 font-mono text-xs text-neutral-400 bg-neutral-800 rounded px-3 py-2 truncate">
            {recipientLink}
          </span>
          <CopyButton text={recipientLink} label="Copy link" />
        </div>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="text-xs text-orange-400 hover:text-orange-300 text-left transition-colors"
        >
          {showQr ? "Hide QR code" : "Show QR code →"}
        </button>
        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-1">
            <QRImage url={recipientLink} />
            <p className="text-xs text-neutral-600">Scan to open recipient view</p>
          </div>
        )}
      </div>

      {/* Top-up */}
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

      {txId && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-green-800 bg-green-900/20 text-sm">
          <span className="text-green-400 flex-1 font-mono text-xs break-all">Tx: {txId}</span>
          <a href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`} target="_blank" rel="noopener noreferrer" className="text-orange-400 text-xs underline shrink-0">Explorer ↗</a>
        </div>
      )}
      {txErr && <p className="text-red-400 text-sm">{txErr}</p>}
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: "green" | "red" }) {
  const cls = highlight === "green" ? "text-green-400" : highlight === "red" ? "text-red-400" : "text-neutral-200";
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : ""} ${cls} text-right break-all`}>{value}</span>
    </div>
  );
}

