// Clarity value types and parsers for SatsFlow contract responses

export interface Stream {
  stream_id: number;
  sender: string;
  token: string;
  deposit: bigint;
  rate_per_second: bigint;
  duration: bigint;
  start_timestamp: bigint;
  last_withdraw_timestamp: bigint;
  total_withdrawn: bigint;
  is_active: boolean;
  recipient_count: bigint;
  name: string;
  description: string;
  // Yield fields (always present in v7; false/0 for non-yield streams)
  yield_enabled: boolean;
  reserve_ratio_bps: bigint;
  deployed_principal: bigint;
  lp_token_balance: bigint;
  total_yield_harvested: bigint;
  strategy_status: bigint; // 0 = inactive, 1 = active
}

export interface YieldInfo {
  yield_enabled: boolean;
  reserve_ratio_bps: bigint;
  deployed_principal: bigint;
  lp_token_balance: bigint;
  total_yield_harvested: bigint;
  last_harvest_timestamp: bigint;
  strategy_status: bigint;
  liquid_reserve: bigint;
}

// Raw Clarity read-only response shape
interface ClarityResult {
  okay: boolean;
  result: string;
}

// Minimal Clarity value representations returned by the API
type ClarityValue =
  | { type: "uint"; value: string }
  | { type: "principal"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "string-ascii"; value: string }
  | { type: "optional"; value: ClarityValue | null }
  | { type: "tuple"; value: Record<string, ClarityValue> }
  | { type: "list"; value: ClarityValue[] }
  | { type: "ok"; value: ClarityValue }
  | { type: "err"; value: ClarityValue };

export function parseReadOnlyResult(raw: ClarityResult): ClarityValue {
  if (!raw.okay) throw new Error("Contract call failed");
  // The API returns a hex-encoded Clarity value; we use the Stacks
  // transactions library to decode it. For UI purposes we extract via
  // the json representation from the newer API which already decodes.
  return raw.result as unknown as ClarityValue;
}

export function parseTupleStream(
  streamId: number,
  tuple: Record<string, ClarityValue>
): Stream {
  return {
    stream_id: streamId,
    sender: (tuple.sender as { type: "principal"; value: string }).value,
    token: (tuple.token as { type: "principal"; value: string }).value,
    deposit: BigInt((tuple.deposit as { type: "uint"; value: string }).value),
    rate_per_second: BigInt(
      (tuple.rate_per_second as { type: "uint"; value: string }).value
    ),
    duration: BigInt(
      (tuple.duration as { type: "uint"; value: string }).value
    ),
    start_timestamp: BigInt(
      (tuple.start_timestamp as { type: "uint"; value: string }).value
    ),
    last_withdraw_timestamp: BigInt(
      (tuple.last_withdraw_timestamp as { type: "uint"; value: string }).value
    ),
    total_withdrawn: BigInt(
      (tuple.total_withdrawn as { type: "uint"; value: string }).value
    ),
    is_active: (tuple.is_active as { type: "bool"; value: boolean }).value,
    recipient_count: BigInt(
      (tuple.recipient_count as { type: "uint"; value: string }).value
    ),
    name: (tuple.name as unknown as { type: "string-ascii"; value: string }).value,
    description: (tuple.description as unknown as { type: "string-ascii"; value: string }).value,
    // Yield fields (v7+; default to false/0 if absent)
    yield_enabled: ((tuple.yield_enabled as { type: "bool"; value: boolean } | undefined)?.value) ?? false,
    reserve_ratio_bps: BigInt(((tuple.reserve_ratio_bps as { type: "uint"; value: string } | undefined)?.value) ?? 0),
    deployed_principal: BigInt(((tuple.deployed_principal as { type: "uint"; value: string } | undefined)?.value) ?? 0),
    lp_token_balance: BigInt(((tuple.lp_token_balance as { type: "uint"; value: string } | undefined)?.value) ?? 0),
    total_yield_harvested: BigInt(((tuple.total_yield_harvested as { type: "uint"; value: string } | undefined)?.value) ?? 0),
    strategy_status: BigInt(((tuple.strategy_status as { type: "uint"; value: string } | undefined)?.value) ?? 0),
  };
}
