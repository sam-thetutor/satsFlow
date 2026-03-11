"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cvToHex,
  uintCV,
  principalCV,
  deserializeCV,
  ClarityType,
} from "@stacks/transactions";
import { CONTRACT_ADDRESS, CONTRACT_NAME } from "@/lib/contract";
import { HIRO_API_BASE } from "@/lib/network";
import { Stream } from "@/lib/types";

// --- Helper: call a read-only function and deserialize the result ---
async function readOnly(
  fn: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  sender: string
) {
  const hexArgs = args.map((a) => cvToHex(a));
  const res = await fetch(
    `${HIRO_API_BASE}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/${fn}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, arguments: hexArgs }),
    }
  );
  if (!res.ok) throw new Error(`API ${res.status}`);
  const { result } = (await res.json()) as { okay: boolean; result: string };
  return deserializeCV(result);
}

// --- Parse a stream tuple from Clarity value ---
function parseStream(id: number, cv: ReturnType<typeof deserializeCV>): Stream {
  if (cv.type !== ClarityType.Tuple) throw new Error("Expected tuple");
  // In @stacks/transactions v7, TupleCV stores fields in .value (a Record)
  const t = (cv as unknown as { value: Record<string, ReturnType<typeof deserializeCV>> }).value;
  return {
    stream_id: id,
    sender:          (t.sender as { value: string }).value,
    token:           (t.token  as { value: string }).value,
    deposit:          BigInt((t.deposit           as { value: bigint }).value),
    rate_per_second:  BigInt((t.rate_per_second   as { value: bigint }).value),
    duration:         BigInt((t.duration          as { value: bigint }).value),
    start_timestamp:  BigInt((t.start_timestamp   as { value: bigint }).value),
    last_withdraw_timestamp: BigInt((t.last_withdraw_timestamp as { value: bigint }).value),
    total_withdrawn:  BigInt((t.total_withdrawn   as { value: bigint }).value),
    is_active: (t.is_active as { type: ClarityType.BoolTrue | ClarityType.BoolFalse }).type === ClarityType.BoolTrue,
    recipient_count: BigInt((t.recipient_count as { value: bigint }).value),
    name: (t.name as { value: string }).value,
    description: (t.description as { value: string }).value,
  };
}

// --- Hook: get a single stream by id ---
export function useStream(streamId: number | null, callerAddress: string | null) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (streamId === null || !callerAddress) return;
    setLoading(true);
    setError(null);
    try {
      const cv = await readOnly("get-stream", [uintCV(streamId)], callerAddress);
      if (cv.type === ClarityType.ResponseOk) {
        const inner = cv.value;
        if (inner.type === ClarityType.OptionalSome) {
            setStream(parseStream(streamId, (inner as unknown as { value: ReturnType<typeof deserializeCV> }).value));
        } else {
          setStream(null);
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [streamId, callerAddress]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { stream, loading, error, refetch: fetch_ };
}

// --- Hook: get stream ids for a sender ---
export function useSenderStreams(address: string | null) {
  const [ids, setIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    readOnly("get-sender-streams", [principalCV(address)], address)
      .then((cv) => {
        if (cv.type === ClarityType.ResponseOk && cv.value.type === ClarityType.List) {
          const items = (cv.value as unknown as { value: { value: bigint }[] }).value;
          setIds(items.map((v) => Number(v.value)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  return { ids, loading };
}

// --- Hook: get stream ids for a recipient ---
export function useRecipientStreams(address: string | null) {
  const [ids, setIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    readOnly("get-recipient-streams", [principalCV(address)], address)
      .then((cv) => {
        if (cv.type === ClarityType.ResponseOk && cv.value.type === ClarityType.List) {
          const items = (cv.value as unknown as { value: { value: bigint }[] }).value;
          setIds(items.map((v) => Number(v.value)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  return { ids, loading };
}

// --- Hook: get claimable amount for a stream (auto-refreshes every 10s) ---
export function useClaimable(streamId: number | null, recipientAddress: string | null) {
  const [claimable, setClaimable] = useState<bigint | null>(null);

  const fetch_ = useCallback(async () => {
    if (streamId === null || !recipientAddress) return;
    try {
      const cv = await readOnly(
        "get-claimable",
        [uintCV(streamId), principalCV(recipientAddress)],
        recipientAddress
      );
      if (cv.type === ClarityType.ResponseOk) {
        setClaimable(BigInt((cv.value as { value: bigint }).value));
      }
    } catch {
      // ignore errors between polls
    }
  }, [streamId, recipientAddress]);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 10_000);
    return () => clearInterval(t);
  }, [fetch_]);

  return claimable;
}

export function useStreamRecipients(streamId: number | null, callerAddress: string | null) {
  const [recipients, setRecipients] = useState<string[]>([]);

  useEffect(() => {
    if (streamId === null || !callerAddress) return;
    readOnly("get-stream-recipients", [uintCV(streamId)], callerAddress)
      .then((cv) => {
        if (cv.type === ClarityType.ResponseOk && cv.value.type === ClarityType.List) {
          const items = (cv.value as unknown as { value: { value: string }[] }).value;
          setRecipients(items.map((v) => v.value));
        }
      })
      .catch(() => setRecipients([]));
  }, [streamId, callerAddress]);

  return recipients;
}

export interface RecipientState {
  address: string;
  rate_per_second: bigint;
  total_withdrawn: bigint;
  allocation: bigint;
}

// --- Hook: per-recipient rate and state ---
export function useRecipientStates(
  streamId: number | null,
  callerAddress: string | null,
  recipientAddresses: string[]
) {
  const [states, setStates] = useState<RecipientState[]>([]);

  useEffect(() => {
    if (streamId === null || !callerAddress || recipientAddresses.length === 0) return;
    let cancelled = false;
    Promise.all(
      recipientAddresses.map((addr) =>
        readOnly("get-stream-recipient", [uintCV(streamId), principalCV(addr)], callerAddress)
          .then((cv) => {
            if (
              cv.type === ClarityType.ResponseOk &&
              cv.value.type === ClarityType.OptionalSome
            ) {
              const t = (cv.value as unknown as { value: { value: Record<string, ReturnType<typeof deserializeCV>> } }).value.value;
              return {
                address: addr,
                rate_per_second: BigInt((t.rate_per_second as { value: bigint }).value),
                total_withdrawn: BigInt((t.total_withdrawn as { value: bigint }).value),
                allocation: BigInt((t.allocation as { value: bigint }).value),
              } satisfies RecipientState;
            }
            return null;
          })
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setStates(results.filter((r): r is RecipientState => r !== null));
    });
    return () => { cancelled = true; };
  }, [streamId, callerAddress, recipientAddresses.join(",")]);

  return states;
}

// --- Hook: BNS .btc name for an address (returns null when none) ---
export function useBnsName(address: string | null): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch(`${HIRO_API_BASE}/v1/addresses/stacks/${address}`)
      .then((r) => r.json())
      .then((data: { names?: string[] }) => {
        if (!cancelled && data.names && data.names.length > 0) {
          setName(data.names[0]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [address]);
  return name;
}

// --- Hook: live-interpolated claimable (ticks every second between polls) ---
// ratePerBlock is the per-block rate; Stacks blocks avg 600s.
export function useLiveClaimable(
  baseClaimable: bigint | null,
  ratePerBlock: bigint | null
): bigint | null {
  const [live, setLive] = useState<bigint | null>(null);
  const lastPollRef = useRef<{ time: number; value: bigint } | null>(null);

  useEffect(() => {
    if (baseClaimable === null) return;
    lastPollRef.current = { time: Date.now(), value: baseClaimable };
    setLive(baseClaimable);
  }, [baseClaimable]);

  useEffect(() => {
    if (ratePerBlock === null || ratePerBlock === 0n) return;
    const timer = setInterval(() => {
      if (!lastPollRef.current) return;
      const elapsed = (Date.now() - lastPollRef.current.time) / 1000;
      const gain = BigInt(Math.floor((elapsed * Number(ratePerBlock)) / 600));
      setLive(lastPollRef.current.value + gain);
    }, 1000);
    return () => clearInterval(timer);
  }, [ratePerBlock]);

  return live;
}

// --- Hook: claimable for each stream in a list (for sweep-all on receive dashboard) ---
export function useMultiClaimable(
  streamIds: number[],
  recipientAddress: string | null
): Record<number, bigint> {
  const [claimables, setClaimables] = useState<Record<number, bigint>>({});

  const fetch_ = useCallback(async () => {
    if (!recipientAddress || streamIds.length === 0) return;
    const results = await Promise.allSettled(
      streamIds.map((id) =>
        readOnly("get-claimable", [uintCV(id), principalCV(recipientAddress)], recipientAddress)
          .then((cv) => {
            if (cv.type === ClarityType.ResponseOk) {
              return { id, value: BigInt((cv.value as { value: bigint }).value) };
            }
            return { id, value: 0n };
          })
          .catch(() => ({ id, value: 0n }))
      )
    );
    const map: Record<number, bigint> = {};
    results.forEach((r) => {
      if (r.status === "fulfilled") map[r.value.id] = r.value.value;
    });
    setClaimables(map);
  }, [streamIds.join(","), recipientAddress]);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 15_000);
    return () => clearInterval(t);
  }, [fetch_]);

  return claimables;
}
