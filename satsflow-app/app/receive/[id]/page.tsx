"use client";

import { use, useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useStream, useClaimable, useRecipientStates, useLiveClaimable, useBnsName } from "@/lib/hooks/useStreams";
import { useWithdraw } from "@/lib/hooks/useTransactions";
import { formatTokenAmount, tokenKeyFromPrincipal, TokenKey } from "@/lib/contract";

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

/** Animated big number that ticks up in real time */
function LiveClaimableDisplay({
  claimable,
  ratePerBlock,
  tokenKey,
}: {
  claimable: bigint | null;
  ratePerBlock: bigint | null;
  tokenKey: TokenKey;
}) {
  const live = useLiveClaimable(claimable, ratePerBlock);

  if (live === null) {
    return <span className="text-neutral-600 font-mono text-3xl font-bold">—</span>;
  }

  // Format to 8 decimals for sBTC, 6 for STX
  const decimals = tokenKey === "sBTC" ? 8 : 6;
  const divisor  = BigInt(10 ** decimals);
  const whole    = live / divisor;
  const frac     = (live % divisor).toString().padStart(decimals, "0");

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="font-mono text-4xl font-bold text-green-400 tabular-nums">
        {whole.toString()}.{frac}
      </div>
      <div className="text-sm text-neutral-500">{tokenKey} claimable now</div>
      <div className="text-xs text-neutral-700">
        updating every second · Stacks blocks ≈ 10 min
      </div>
    </div>
  );
}

export default function RecipientStreamDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const streamId = parseInt(id, 10);
  const { address } = useWallet();
  const { stream, loading, error, refetch } = useStream(streamId, address);
  const recipientStates = useRecipientStates(streamId, address, address ? [address] : []);
  const claimable = useClaimable(streamId, address);
  const myState   = recipientStates.find((s) => s.address === address);
  const bnsName   = useBnsName(address);
  const withdraw  = useWithdraw();

  const [txId,  setTxId]  = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const pageLink = typeof window !== "undefined"
    ? window.location.href
    : `/receive/${streamId}`;

  if (loading) return (
    <div className="max-w-lg mx-auto pt-10 flex flex-col gap-4 animate-pulse">
      <div className="h-7 bg-neutral-800 rounded w-40" />
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 bg-neutral-800 rounded" />
        ))}
      </div>
    </div>
  );
  if (error)   return <p className="text-red-400 pt-10 text-center">{error}</p>;
  if (!stream) return <p className="text-neutral-400 pt-10 text-center">Stream not found.</p>;

  const tokenKey      = tokenKeyFromPrincipal(stream.token) ?? "STX";
  const myRemaining   = myState ? myState.allocation - myState.total_withdrawn : null;

  function handleWithdraw() {
    setTxErr(null);
    withdraw(streamId, (id) => { setTxId(id); refetch(); }, () => setTxErr("Cancelled."));
  }

  return (
    <div className="max-w-lg mx-auto pt-10 flex flex-col gap-6 pb-12">

      {/* Live claimable — the "wow" display */}
      {stream.is_active && (
        <div className="rounded-xl border border-green-800/50 bg-green-900/10 p-6 text-center flex flex-col items-center gap-4">
          <p className="text-xs text-neutral-500 uppercase tracking-widest">Your accrued balance</p>
          <LiveClaimableDisplay
            claimable={claimable}
            ratePerBlock={myState?.rate_per_second ?? null}
            tokenKey={tokenKey as TokenKey}
          />
          {stream.is_active && (
            <button
              onClick={handleWithdraw}
              className="mt-1 px-8 py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-semibold transition-colors"
            >
              Withdraw to Wallet
            </button>
          )}
        </div>
      )}

      <h1 className="text-2xl font-bold">{stream.name || `Stream #${streamId}`}</h1>

      {/* Details card */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        {stream.description && <Row label="Description" value={stream.description} />}
        <Row label="Status"    value={stream.is_active ? "Active" : "Inactive"} highlight={stream.is_active ? "green" : "red"} />
        <Row label="From"      value={stream.sender} mono />
        <Row label="Your address" value={bnsName ? `${bnsName} (${address?.slice(0, 8)}…)` : (address ?? "—")} mono={!bnsName} />
        <Row label="Token"     value={tokenKey} />

        <div className="border-t border-neutral-800 pt-3 mt-1 flex flex-col gap-2">
          <p className="text-neutral-500 text-xs mb-1">Your entitlement</p>
          <Row label="Rate/block"   value={myState ? formatTokenAmount(myState.rate_per_second, tokenKey as TokenKey) : "Loading…"} />
          <Row label="Withdrawn"    value={myState ? formatTokenAmount(myState.total_withdrawn, tokenKey as TokenKey) : "Loading…"} />
          <Row label="Allocation"   value={myState ? formatTokenAmount(myState.allocation, tokenKey as TokenKey) : "Loading…"} />
          <Row label="Remaining"    value={myRemaining !== null ? formatTokenAmount(myRemaining, tokenKey as TokenKey) : "Loading…"} />
          {claimable !== null && (
            <Row label="Claimable now" value={formatTokenAmount(claimable, tokenKey as TokenKey)} highlight="green" />
          )}
        </div>
      </div>

      {/* Share / QR */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 flex flex-col gap-3 text-sm">
        <p className="font-semibold">Share this stream view</p>
        <div className="flex items-center gap-2">
          <span className="flex-1 font-mono text-xs text-neutral-400 bg-neutral-800 rounded px-3 py-2 truncate">
            {pageLink}
          </span>
          <CopyButton text={pageLink} label="Copy" />
        </div>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="text-xs text-orange-400 hover:text-orange-300 text-left transition-colors"
        >
          {showQr ? "Hide QR" : "Show QR code →"}
        </button>
        {showQr && (
          <div className="flex flex-col items-center gap-2 pt-1">
            <QRImage url={pageLink} />
            <p className="text-xs text-neutral-600">Scan to open this view</p>
          </div>
        )}
      </div>

      {/* If inactive, show a non-prominent withdraw button still */}
      {!stream.is_active && claimable !== null && claimable > 0n && (
        <button
          onClick={handleWithdraw}
          className="py-2.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors"
        >
          Withdraw Remaining Funds
        </button>
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


