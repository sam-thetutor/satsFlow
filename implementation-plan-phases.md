# SatsFlow Implementation Plan (Phased)

## Progress Snapshot (As of 2026-03-11)

### Completed So Far
- Pitch materials reviewed and compressed (`pitch-deck-compressed.md`).
- Docs-grounded build roadmap created (`implementation-plan-phases.md`) and executed through core contract phases.
- Clarinet workspace scaffolded and configured with sBTC requirement.
- Core stream contract implemented and hardened across lifecycle flows.
- Multi-token support added: sBTC + native STX.
- Contract versions deployed on testnet due immutable contract naming (`v2`, then `v3`).
- Final active deployment validated: `ST2QFJV445B22TXQXYW0M3EDEYSDGDVV5N15PE2XN.satsflow-streams-v3`.
- Local test suite updated and passing (`20/20`).
- Testnet smoke interface checks passing for `v3`.
- Real on-chain flow successfully executed on testnet (`create -> top-up -> cancel`) with successful tx confirmations.
- Frontend integrated with latest contract workflow and multi-recipient creation UX.
- Stream dashboards and detail pages updated for v5 data model (separate recipient maps/state).
- Recipient detail page now shows recipient-specific metrics only (rate, withdrawn, allocation, remaining, claimable).
- Claimable amount polling fixed to refresh live without manual reload.
- Withdraw/cancel transaction post-condition mode fixed to avoid false wallet aborts.
- Active app contract target updated to `ST2QFJV445B22TXQXYW0M3EDEYSDGDVV5N15PE2XN.satsflow-streams-v5`.

### Live Testnet Evidence
- `create-stream` success: `(ok u1)`
- `top-up-stream` success: `(ok u3000)`
- `cancel-stream` success: `(ok u3000)`
- Resulting stream state for id `u1`: `is_active = false` (expected because it was canceled in the same flow).

## Current Contract Inventory (`satsflow-streams-v5`)

### Supported Tokens
- sBTC token contract: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`
- Native STX token principal: `SP000000000000000000002Q6VF78`

### Public Functions
- `create-stream(recipient-entries, token, deposit, name, description)`
- `withdraw(stream-id)`
- `top-up-stream(stream-id, amount)`
- `cancel-stream(stream-id)`

### Read-Only Functions
- `get-stream(stream-id)`
- `get-stream-recipients(stream-id)`
- `get-stream-recipient(stream-id, recipient)`
- `get-claimable(stream-id, recipient)`
- `get-sender-streams(sender)`
- `get-recipient-streams(recipient)`

### Storage and Indexing
- `next_stream_id` counter.
- `streams` map for full stream state.
- `sender_stream_index` and `recipient_stream_index` maps with capped list size (`200`).

### Core Safety and Behavior
- Strict authorization checks:
  - sender-only: `top-up-stream`, `cancel-stream`
  - recipient-only: `withdraw`
- Input validation for token, deposit/rate/top-up amounts, and recipient principal checks.
- Claimable amount is time-based and capped by remaining deposit (no over-withdrawal).
- Stream auto-inactivates when deposit is exhausted; explicit inactivation on cancel.
- Explicit error-code model for invalid input, auth failures, transfer failures, and missing/inactive streams.

## Goal
Build and ship an MVP of SatsFlow on Stacks with sBTC-powered continuous payout streams, then harden and prepare for demo/testnet launch.

## Phase 0 - Foundation and Setup
Status: Completed on 2026-03-11

### Objective
Create a reliable local development environment for Clarity contracts and frontend integration.

### Tasks
- Install and verify Clarinet.
- Initialize contract workspace with `clarinet new`.
- Add official sBTC contract requirements:
  - `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit`
- Scaffold first contract and test structure.
- Set coding conventions for error codes, naming, and function layout.

### Deliverables
- Working Clarinet project structure.
- sBTC requirements configured in project.
- Initial contract file and test file scaffolded.

### Exit Criteria
- `clarinet check` passes.
- Project can run tests (`npm run test`) without environment issues.

---

## Phase 1 - Core Stream Contract (MVP Logic)
Status: Completed on 2026-03-11

### Objective
Implement minimal, production-shaped stream logic for single sender and single recipient streams.

### Tasks
- Define stream storage model:
  - `stream-id`, `sender`, `recipient`, `token`, `deposit`, `rate-per-second`
  - `start-timestamp`, `last-withdraw-timestamp`, `total-withdrawn`, `is-active`
- Implement public functions:
  - `create-stream`
  - `withdraw`
  - `top-up-stream`
  - `cancel-stream`
- Implement read-only functions:
  - `get-stream`
  - `get-claimable`
  - `get-sender-streams`
  - `get-recipient-streams`
- Integrate sBTC token transfer calls via official token contract.
- Use integer-only accrual math and cap claimable to remaining deposit.

### Deliverables
- Deployable Clarity contract implementing full MVP stream lifecycle.
- Basic function documentation and error code table.

### Exit Criteria
- All public and read-only functions compile and execute in simnet.
- Manual sanity checks for create, accrue, withdraw, top-up, cancel all pass.

---

## Phase 2 - Security and Invariant Hardening
Status: Completed on 2026-03-11

### Objective
Reduce exploit and misuse risk before frontend integration.

### Tasks
- Add strict authorization checks:
  - sender-only actions (`create`, `top-up`, `cancel`)
  - recipient-only action (`withdraw`)
- Add input validation:
  - positive deposit/rate
  - valid principals
  - active stream checks
- Add invariant checks:
  - no over-withdrawal
  - idempotent behavior on exhausted streams
  - safe cancel/refund of unaccrued value
- Ensure explicit and stable error responses.

### Deliverables
- Hardened contract with clear constraints and guardrails.
- Written invariants section in docs.

### Exit Criteria
- Negative test cases for invalid actions pass.
- No known logic path allows unauthorized transfer.

---

## Phase 3 - Test Suite and Quality Gates
Status: Completed on 2026-03-11

### Objective
Build confidence with deterministic unit and integration-like tests.

### Tasks
- Add Clarinet SDK + Vitest coverage for:
  - happy paths (create, accrue, withdraw, top-up, cancel)
  - edge cases (zero values, same sender/recipient if disallowed)
  - failure paths (unauthorized caller, inactive stream, over-withdraw)
  - multi-account behavior
- Add event/assertion checks where useful.
- Generate coverage and cost reports.

### Deliverables
- Stable test suite with repeatable results.
- Coverage and cost artifacts.

### Exit Criteria
- Test suite passes consistently.
- Core lifecycle has strong happy and failure coverage.

---

## Phase 4 - Frontend MVP Integration
Status: In Progress (major flows implemented on 2026-03-11)

### Objective
Ship usable interfaces for sender and recipient workflows.

### Tasks
- Set up wallet connection using Stacks Connect.
- Implement write transaction flows:
  - create stream
  - withdraw
  - top-up
  - cancel
- Implement read-only data hydration for dashboards and stream detail.
- Build pages:
  - landing
  - create stream
  - sender dashboard
  - recipient dashboard
  - stream detail
- Add live accrual UI (display-level ticking) while keeping contract state as source of truth.

### Deliverables
- End-to-end usable MVP frontend connected to contract.

### Exit Criteria
- User can complete full stream lifecycle from UI with connected wallet.
- UI reflects on-chain state correctly after transactions confirm.

### Phase 4 Progress Notes (2026-03-11)
- Wallet connect/disconnect and account balance display wired.
- Stream create flow supports multiple recipients with individual rates.
- Sender dashboard and stream detail views working against v5 structures.
- Recipient dashboard and recipient-only stream detail view implemented.
- Live claimable polling and transaction result/txid feedback implemented.
- Remaining: add broader UX polish (empty/error states and loading skeletons) and run full multi-wallet acceptance pass.

---

## Phase 5 - Transaction Safety (Post-Conditions)
Status: In Progress

### Objective
Protect users from unexpected asset transfers in contract calls.

### Tasks
- Add post-conditions in frontend transaction calls using `Pc` helper.
- Use `postConditionMode: deny` by default.
- Add specific FT post-conditions for sBTC movement in each write action.
- Validate wallet confirmation shows expected post-condition statements.

### Deliverables
- Post-conditions integrated into all write transactions.

### Exit Criteria
- Transactions fail safely if transfer behavior exceeds declared limits.
- All wallet prompts clearly display expected asset movement.

### Phase 5 Progress Notes (2026-03-11)
- Spend-side post-conditions added for create/top-up.
- Withdraw/cancel adjusted to avoid false-negative wallet aborts under deny mode.
- Remaining: re-introduce stricter receive/refund-aware post-conditions where feasible and validate prompts across supported wallets.

---

## Phase 6 - Testnet Deployment and Verification
Status: Completed on 2026-03-11 (Contract Deployment and Verification)

### Objective
Deploy and verify a live testnet version for demo and judging.

### Tasks
- Configure deployer account in `settings/Testnet.toml`.
- Generate deployment plan:
  - `clarinet deployments generate --testnet --medium-cost`
- Apply deployment:
  - `clarinet deployments apply --testnet`
- Verify contract addresses and function behavior on testnet.
- Fund demo wallets with testnet STX/sBTC and run full flow.

### Deliverables
- Testnet-deployed contract and working frontend integration.
- Verifiable tx links and contract identifiers.

### Exit Criteria
- Full lifecycle works on testnet (not only simnet).
- Demo path runs end-to-end with no manual patching.

---

## Phase 7 - Demo Readiness and Launch Packet
Status: In Progress

### Objective
Prepare final hackathon-ready package and reduce demo risk.

### Tasks
- Prepare scripted 3-5 minute demo flow.
- Add fallback demo path (pre-created stream).
- Finalize concise architecture + security notes.
- Prepare quick troubleshooting checklist for live demo.
- Record key transaction links and screenshots.

### Deliverables
- Demo script.
- Proof pack (links, screenshots, architecture summary).
- Final submission notes.

### Exit Criteria
- Team can run demo start-to-finish consistently.
- Submission package is complete and judge-friendly.

---

---

## Phase 8 - Bitflow Yield Integration (v6 Contract)
Status: In Progress (contract written, Clarinet check passing)

### Objective
Extend SatsFlow with an optional Bitflow XYK yield strategy for sBTC streams.
Sender can optionally deploy a portion of the stream deposit to the Bitflow sBTC-BDC pool and earn LP fees that extend the life of the stream.

### Design Decisions
- **Yield is sBTC-only.** STX streams use the original v5 logic.
- **Sender-side only.** Recipients interact identically to v5 — they just call `withdraw`.
- **Two-path withdraw:**
  - Path A: liquid reserve >= claimable --> pay directly.
  - Path B: reserve short AND yield enabled --> try inline Bitflow unwind via `match` (fail-soft):
    - Success: unwind LP, pay full claimable.
    - Failure: pay reserve remainder, set strategy to PAUSED.
- **`yield_enabled=false` is identical to v5.** Full backward compatibility.
- **Mainnet-only yielding.** Bitflow XYK contracts are mainnet; yield functions fail on testnet/devnet.

### Confirmed Contract Addresses (Mainnet)
- Bitflow XYK Core: `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2`
- sBTC-BDC Pool: `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1`
- BDC Token: `SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC`
  (verified via Hiro API pool query + manual c32 decode of on-chain principal bytes)
- sBTC Token: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`

### XYK Core Function Signatures (verified from on-chain source)
- `swap-x-for-y (pool <xyk-pool-trait>) (x-token <sip-010-trait>) (y-token <sip-010-trait>) (x-amount uint) (min-dy uint)` -> `(ok dy)` [min-dy must be > 0]
- `swap-y-for-x (pool <xyk-pool-trait>) (x-token <sip-010-trait>) (y-token <sip-010-trait>) (y-amount uint) (min-dx uint)` -> `(ok dx)` [min-dx must be > 0]
- `add-liquidity (pool <xyk-pool-trait>) (x-token <sip-010-trait>) (y-token <sip-010-trait>) (x-amount uint) (min-dlp uint)` -> `(ok dlp)` [min-dlp must be > 0; XYK auto-computes y-amount]
- `withdraw-liquidity (pool <xyk-pool-trait>) (x-token <sip-010-trait>) (y-token <sip-010-trait>) (amount uint) (min-x-amount uint) (min-y-amount uint)` -> `(ok { x-amount: uint, y-amount: uint })`

### v6 New/Modified Functions
**Public:**
- `create-stream-with-yield(recipient-entries, deposit, name, description, reserve-ratio-bps)` -- creates yield stream and immediately deploys LP
- `withdraw` -- two-path (Path A / Path B with fail-soft match)
- `cancel-stream` -- unwinds LP if active (fail-soft), then distributes + refunds
- `pause-yield-strategy(stream-id)` -- sets PAUSED without unwind
- `unwind-yield-strategy(stream-id)` -- fully unwinds LP -> liquid reserve

**Read-only:**
- `get-yield-info(stream-id)` -- returns all yield fields + computed liquid_reserve

**Private:**
- `compute-liquid-reserve(stream)` -- deposit + total_yield_harvested - total_withdrawn - deployed_principal
- `bitflow-deploy(deploy-amount)` -- swap half->BDC, add-liquidity with other half; returns LP minted
- `bitflow-unwind(lp-balance, deployed-principal)` -- withdraw-liquidity + swap BDC->sBTC; returns { sbtc-received, yield-gained }

### Strategy Status Model
- `STRATEGY_INACTIVE (u0)` -- no LP, yield_enabled may be true
- `STRATEGY_ACTIVE (u1)` -- LP live in Bitflow
- `STRATEGY_PAUSED (u2)` -- LP in Bitflow but suspended (e.g. after failed unwind); pay from liquid only
- `STRATEGY_UNWOUND (u3)` -- LP fully returned; stream pays from liquid reserve only

### Deploy Sequence (bitflow-deploy)
1. `swap-x-for-y` half of deploy-amount sBTC -> BDC (pool auto-calculates)
2. `add-liquidity` with remaining half sBTC (XYK auto-pulls proportionate BDC)
3. Residual BDC stays in contract; swapped back on unwind
Note: as-contract is used so tx-sender = current-contract for all Bitflow calls

### Unwind Sequence (bitflow-unwind)
1. `withdraw-liquidity` all LP tokens -> sBTC + BDC
2. `swap-y-for-x` all BDC -> sBTC
3. Total sBTC = from-LP + from-swap; yield-gained = max(0, total - deployed_principal)

### v6 Extended streams Map Fields
| Field | Type | Description |
|---|---|---|
| yield_enabled | bool | Whether yield strategy is enabled |
| reserve_ratio_bps | uint | BPS of deposit kept as liquid (>= 3000) |
| deployed_principal | uint | sBTC deployed to LP (updated on deploy/unwind) |
| lp_token_balance | uint | LP tokens held by this contract |
| total_yield_harvested | uint | Cumulative sBTC gain from unwinds |
| last_harvest_timestamp | uint | Block height of last LP unwind |
| strategy_status | uint | INACTIVE / ACTIVE / PAUSED / UNWOUND |

### Clarinet.toml Requirements Added
- `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1`
- `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2`
- `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2`
- `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1`
- `SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC`

### Deliverables
- `satsflow-streams-v6.clar` -- written and `clarinet check` passing (no errors, warnings only)
- Updated `Clarinet.toml` with Bitflow requirements and v6 contract registration
- Updated `bitflow-integration-plan.md` with confirmed addresses and design

### Exit Criteria
- `clarinet check` passes for v6 contract
- yield_enabled=false path is testable on simnet/testnet (identical to v5)
- yield_enabled=true path is deployable on mainnet with Bitflow XYK live
- Updated test cases cover both yield paths (Path A, Path B success, Path B fail-soft)

### Phase 8 Progress Notes
- BDC token address confirmed: `SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC`
  (decoded from raw pool data hex using c32 algorithm verified against known sbtc-token address)
- XYK core function signatures verified by fetching on-chain Clarity source
- `satsflow-streams-v6.clar` written and passing `clarinet check` with zero errors
- Remaining: test suite additions, frontend integration for yield UI, mainnet deployment

---

## Cross-Phase Standards
- Keep scope to MVP (single sender -> multi-recipient streams with per-recipient rates).
- Prefer explicit errors over silent failures.
- Maintain deterministic integer accounting.
- Keep contract interfaces stable once frontend integration starts.
- Do not add advanced modules (marketplace, splits, fiat, yield) before MVP completion.

---

## Immediate Next Step
Phase 8 continuation + Phase 4/5 closeout:
1. Add test cases for v6: yield-disabled path (identical to v5), yield-enabled creation, two-path withdraw, cancel with/without LP, pause/unwind strategy functions.
2. Frontend: add `create-stream-with-yield` UI, yield info display in sender dashboard, and strategy management buttons (pause/unwind).
3. Phase 4/5 closeout: end-to-end multi-wallet test matrix, UX hardening (loading/error/empty states), post-condition validation.
4. Phase 7: demo script + proof pack update with v5/v6 contract IDs.