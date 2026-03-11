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

## Cross-Phase Standards
- Keep scope to MVP (single sender -> multi-recipient streams with per-recipient rates).
- Prefer explicit errors over silent failures.
- Maintain deterministic integer accounting.
- Keep contract interfaces stable once frontend integration starts.
- Do not add advanced modules (marketplace, splits, fiat, yield) before MVP completion.

---

## Immediate Next Step
Run a focused **Phase 4/5 closeout** pass:
1. Execute end-to-end multi-wallet test matrix (`create -> receive view -> withdraw -> sender top-up -> cancel`) and capture tx links.
2. Add final UX hardening for loading/error/empty states on all dashboards and detail pages.
3. Validate post-condition behavior for create/top-up/withdraw/cancel on target wallets and document the final policy.
4. Update demo script + proof pack with v5 contract id, screenshots, and known constraints.