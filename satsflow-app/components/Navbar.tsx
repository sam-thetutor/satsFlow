"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { fetchAccountBalance } from "@/lib/network";

export default function Navbar() {
  const { connected, address, connect, disconnect } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !address) {
      setBalance(null);
      return;
    }

    let cancelled = false;

    void fetchAccountBalance(address)
      .then((microStx) => {
        if (cancelled) return;
        const stx = Number(microStx) / 1_000_000;
        setBalance(`${stx.toFixed(2)} STX`);
      })
      .catch(() => {
        if (cancelled) return;
        setBalance(null);
      });

    return () => {
      cancelled = true;
    };
  }, [connected, address]);

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-orange-400">
          SatsFlow
        </Link>
        {connected && (
          <>
            <Link href="/send/dashboard" className="text-sm text-neutral-300 hover:text-white transition-colors">
              My Streams
            </Link>
            <Link href="/send" className="text-sm text-neutral-300 hover:text-white transition-colors">
              Send
            </Link>
            <Link href="/receive" className="text-sm text-neutral-300 hover:text-white transition-colors">
              Receive
            </Link>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {connected && address ? (
          <>
            {balance && (
              <span className="text-xs text-neutral-300">
                {balance}
              </span>
            )}
            <span className="text-xs text-neutral-400 font-mono">
              {address.slice(0, 8)}…{address.slice(-4)}
            </span>
            <button
              onClick={disconnect}
              className="text-xs px-3 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            className="text-sm px-4 py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-white font-medium transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
