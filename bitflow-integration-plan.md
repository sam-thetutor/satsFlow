# SatsFlow x Bitflow Integration Plan

## Purpose
This document defines how to integrate Bitflow into SatsFlow to make idle stream balances yield-bearing while preserving recipient withdrawal reliability.

The goal is to upgrade SatsFlow from a payment streaming app to a Bitcoin-native payment and yield primitive on Stacks.

## Why This Integration Matters

### 1. Idle Capital Problem
In the current SatsFlow model, stream deposits remain in the contract until recipients withdraw. During that time, unclaimed funds are idle and generate no return.

### 2. Bitflow Solves the Idle Yield Gap
Bitflow is a Stacks-native liquidity and execution layer where assets can earn real yield from actual protocol activity. Integrating it allows SatsFlow to put unutilized stream capital to work.

### 3. Stronger Stacks Alignment
The hackathon judging criteria explicitly rewards use of Stacks ecosystem components such as Bitflow and USDCx. This integration directly increases ecosystem alignment and technical depth.

### 4. Better Value for Senders
Senders funding long-running streams can recover a portion of payment cost through generated yield, while recipients still receive on-demand withdrawals.

### 5. Product Differentiation
Continuous payouts exist in other ecosystems, but yield-bearing continuous payouts on Bitcoin/Stacks is strongly differentiated and narratively compelling.

## Product Outcome
With this integration:
- Senders create a stream as usual.
- A reserve is held liquid for recipient withdrawals.
- Excess idle balance is deployed into a Bitflow position.
- Yield is harvested back into the stream reserve.
- Recipient withdrawal UX stays simple: accrue continuously, withdraw anytime.

## Scope
This plan covers:
- Contract-level integration approach.
- Frontend and SDK integration.
- Security constraints and failure handling.
- Implementation phases and acceptance criteria.

This plan does not assume a fully generalized yield aggregator. It targets a single Bitflow strategy path first, then extends iteratively.

## High-Level Architecture

```text
Sender Deposit (sBTC)
      |
      +--> Liquid Reserve (30% min, in SatsFlow contract)
      |      - Covers near-term withdrawals
      |      - Topped up via rebalance as it drains
      |
      +--> Yield Allocation (Bitflow position, up to 70%)
             - Earns protocol fees/yield
             - Gradually unwound over stream lifetime to fund reserve

On recipient withdraw:
  Path A (reserve >= claimable):
    → Pay recipient from reserve directly (cheap, always works)

  Path B (reserve < claimable, yield_enabled = true):
    → Try bounded Bitflow unwind to top up reserve
    → If unwind succeeds: pay full claimable amount
    → If unwind fails: pay whatever reserve remains, mark strategy as paused
    → Recipient is never fully blocked

On sender cancel:
- Unwind full Bitflow position first
- Then refund unaccrued balance to sender
```

## Integration Design

### Contract Strategy (SatsFlow v6)
Add a new contract version (`satsflow-streams-v6.clar`) to avoid mutating previous deployed versions.

#### New State
Add per-stream yield metadata:
- `yield_enabled: bool`
- `reserve_ratio_bps: uint` (for example 3000 = 30%)
- `deployed_principal: uint`
- `lp_token_balance: uint`
- `total_yield_harvested: uint`
- `last_harvest_timestamp: uint`
- `strategy_status: uint` (active, paused, unwound)

#### New Functions
- `create-stream-with-yield(...)` — same as `create-stream` but splits deposit into reserve + Bitflow position; sender acknowledges that recipients can trigger partial unwinds
- `rebalance-reserve(stream-id)` — sender-callable proactive top-up; partially unwinds Bitflow to restore reserve to target ratio
- `harvest-yield(stream-id)` — sender-callable; pulls earned yield back into reserve, extending stream runway
- `pause-strategy(stream-id)` — sender-only; halts new deployments; stream continues on reserve only
- `unwind-strategy(stream-id)` — sender-only; fully exits Bitflow position, returns all to liquid reserve

#### Existing Function Changes
- `withdraw(stream-id)`
  - **Path A** — reserve has sufficient funds: pay recipient from reserve directly. No Bitflow interaction.
  - **Path B** — reserve is insufficient AND `yield_enabled = true`: attempt a bounded Bitflow unwind inline.
    - If unwind succeeds: top up reserve, pay full claimable amount to recipient.
    - If unwind fails (slippage, external error): pay whatever reserve balance remains, mark `strategy_status` as paused. Recipient is never fully blocked.
  - Recipient triggers the unwind naturally through normal `withdraw` — no separate call needed.
  - Slippage timing risk on the unwind falls within the stream, not on the recipient's accounting.
- `cancel-stream(stream-id)`
  - Unwind full Bitflow position first.
  - Then return remaining stream balance to sender.

### Frontend Strategy
In `satsflow-app`:
- Add a `Yield Boost` toggle on stream creation.
- Show projected APY and strategy risk disclaimer.
- Show stream health metrics:
  - Reserve coverage (time remaining at current rates)
  - Deployed amount
  - Yield earned (lifetime)
  - Last harvest time
- Add sender actions:
  - Harvest
  - Pause strategy
  - Unwind strategy

### Bitflow Contract Reference (Mainnet — Confirmed)

> ⚠️ **Testnet status**: XYK, Router, Wrapper, and Emissions contracts are NOT deployed on testnet. Only StableSwap/Earn contracts exist on testnet, and those are USDA-sUSDT only. The Bitflow yield integration is **mainnet-only**.

#### Deployer Addresses
- StableSwap contracts: `SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M`
- XYK contracts: `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR`

#### Target Contracts for v6
| Contract | Address | Purpose |
|---|---|---|
| XYK Core | `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2` | Entry point for `add-liquidity` and `withdraw-liquidity` |
| sBTC-BDC Pool (LP token) | `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1` | Pool trait + LP token contract passed as `pool-trait` argument |
| sBTC token | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` | x-token in the sBTC-BDC pair |

#### Exact Function Signatures (from on-chain source)

**Deposit into LP:**
```clarity
(contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
  add-liquidity
  pool-trait        ;; SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
  x-token-trait     ;; sbtc-token (x side)
  y-token-trait     ;; bdc-token (y side)
  x-amount          ;; sBTC amount to deposit (uint)
  min-dlp           ;; minimum LP tokens to accept (slippage guard, uint)
)
;; Returns: (ok dlp) — number of LP tokens minted to caller
```

**Withdraw from LP:**
```clarity
(contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
  withdraw-liquidity
  pool-trait        ;; SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
  x-token-trait     ;; sbtc-token
  y-token-trait     ;; bdc-token
  amount            ;; LP token amount to burn (uint)
  min-x-amount      ;; minimum sBTC to receive back (slippage guard, uint)
  min-y-amount      ;; minimum BDC to receive back (slippage guard, uint)
)
;; Returns: (ok {x-amount: uint, y-amount: uint}) — sBTC and BDC returned to caller
```

**Read LP token balance:**
```clarity
(contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
  get-balance
  address  ;; principal whose LP balance to check
)
;; Returns: (ok uint)
```

#### ⚠️ Critical Design Constraint: Two-Token Pool

The sBTC-BDC pool requires **both sBTC and BDC** to add liquidity. `add-liquidity` automatically calculates the required BDC amount proportional to the current pool ratio, then transfers both tokens from the caller.

The SatsFlow contract only holds sBTC. This means:
1. Before calling `add-liquidity`, the contract must **first swap half the deployment amount from sBTC to BDC** (via `swap-x-for-y` in the XYK core), then deposit both sides.
2. On `withdraw-liquidity`, the contract receives both sBTC and BDC back. It must swap the BDC back to sBTC before crediting the reserve.
3. This adds two additional atomic swap calls per deposit/unwind cycle and introduces short-term BDC price exposure between the swap and the LP deposit.

**Implication for v6 design**: The yield deployment path is not a single `add-liquidity` call. It is a two-step atomic sequence: `swap sBTC → BDC` then `add-liquidity`. The unwind path is: `withdraw-liquidity` then `swap BDC → sBTC`. Both sequences must be atomic within a single transaction.

### Bitflow SDK Usage
Use `@bitflowlabs/core-sdk` for market/routing data and execution prep:
- Token availability
- Quote retrieval (`get-dy`, `get-dlp` read-only calls on XYK core)
- Building `min-dlp`, `min-x-amount`, `min-y-amount` slippage parameters before submitting the transaction

Use direct Clarity contract-to-contract calls (`contract-call?`) for all on-chain state transitions. Do not use the SDK for the actual LP deposit/withdraw — those must be atomic with stream accounting.

## Safety Model

### Guiding Principle
Recipient withdrawals must remain reliable even if Bitflow integration is degraded.

### Safety Controls
- Maintain minimum reserve threshold before any yield deployment.
- Cap strategy allocation (max 70% of stream balance; 30% always stays liquid).
- Add slippage bounds for all Bitflow interactions.
- Add strategy pause switch for emergency handling.
- Fail closed on external call errors (do not corrupt stream accounting).
- Preserve recipient claims accounting independent of external strategy status.
- Recipient can trigger a bounded unwind via `withdraw` only — not as a standalone call.
- Sender must acknowledge at stream creation that recipients can trigger partial unwinds on demand.

### Failure Modes and Handling
- Reserve runs dry during recipient withdraw:
  - Try bounded Bitflow unwind inline inside `withdraw`.
  - If unwind succeeds: pay full claimable amount.
  - If unwind fails: pay whatever reserve remains, mark strategy as paused. Stream stays active.
- External strategy call fails (rebalance or harvest):
  - Keep stream active with reserve-only behavior.
  - Mark `strategy_status` as paused.
- Quote/API unavailable:
  - Use last known conservative parameters or disable new strategy entries.
- Large volatility/slippage during unwind:
  - Enforce min-out checks; if check fails, fall back to partial reserve payment and pause strategy.

## Test and Validation Plan

### Contract Tests (Clarinet)
- Create stream with yield disabled (baseline parity, identical to v5 behavior).
- Create stream with yield enabled and valid reserve ratio.
- Withdraw Path A: reserve is healthy, pay directly, no Bitflow call.
- Withdraw Path B (success): reserve is empty, inline unwind succeeds, recipient paid in full.
- Withdraw Path B (failure): reserve is empty, inline unwind fails, recipient paid partial from reserve, strategy marked paused.
- Withdraw after strategy is paused: reserve-only behavior, no unwind attempted.
- Cancel stream with active strategy: full unwind before refund.
- Harvest flow accounting correctness.
- Rebalance reserve: partial unwind restores reserve to target ratio.
- Pause/unwind authorization checks (sender-only).
- Recipient cannot call pause/unwind directly.
- Error-path tests for failed external calls.

### Frontend Tests
- Form validation for reserve ratio and strategy toggle.
- Correct UI state after wallet tx success/failure.
- Live metric rendering and fallback states.

### End-to-End Demo Checks
- Create stream with `Yield Boost` enabled.
- Show reserve + deployed balances.
- Simulate time/accrual.
- Harvest and display increased reserve/yield metrics.
- Recipient withdraw still succeeds.

## Phased Implementation Plan

### Phase 1: Discovery and Interface Lock (Day 1)
- Confirm exact Bitflow contracts and token pairs to target.
- Lock strategy interface and data model.
- Produce contract call matrix and required post conditions.

Exit criteria:
- Integration interface spec approved.

### Phase 2: Contract Implementation (Days 2-3)
- Build `satsflow-streams-v6.clar` with yield state and new functions.
- Add reserve and allocation guards.
- Preserve v5 functional behavior when yield is disabled.

Exit criteria:
- Contract compiles and core flows pass local tests.

### Phase 3: Test Hardening (Day 4)
- Add negative-path and edge-case tests.
- Verify accounting invariants and no over-withdraw scenarios.

Exit criteria:
- High-confidence contract suite passes.

### Phase 4: Frontend + SDK Integration (Days 5-6)
- Add yield UI controls and metrics.
- Integrate Bitflow SDK quote and routing utilities.
- Add transaction flows for sender strategy actions.

Exit criteria:
- End-to-end user flow works in app with wallet interaction.

### Phase 5: Demo and Submission Prep (Days 7-9)
- Record deterministic demo script and fallback plan.
- Update pitch narrative and architecture visuals.
- Prepare repository and submission artifacts.

Exit criteria:
- Submission-ready GitHub, demo, and pitch video.

## Deliverables
- `satsflow-streams-v6.clar` contract with yield strategy support.
- Updated app flow for yield-enabled streams.
- Tests for reliability and accounting safety.
- Demo script and pitch framing that highlights Bitcoin utility and Stacks alignment.

## Risks and Mitigations
- Risk: Contract integration complexity within timeline.
  - Mitigation: Single strategy path first, avoid generalized multi-strategy router.
- Risk: Testnet/mainnet parity issues.
  - Mitigation: Lock network assumptions early and provide controlled fallback demo flow.
- Risk: UX confusion around strategy state.
  - Mitigation: Keep recipient UX unchanged and isolate strategy controls to sender views.

## Success Criteria
- Recipient can always withdraw accrued funds under defined reserve policy.
- Yield-enabled streams demonstrate measurable additional value over baseline streams.
- Integration is auditable, deterministic, and resilient to external call failure.
- Project narrative clearly maps to Stacks goals: activating Bitcoin capital with practical utility.

## Notes for Hackathon Positioning
This integration should be presented as a pragmatic, production-minded upgrade:
- Not speculative token rewards.
- Real utility for contributor payments.
- Real Bitcoin-denominated productivity for idle funds.

Tagline option:
"SatsFlow turns idle stream balances into productive Bitcoin capital while preserving continuous, self-custodial payouts."
