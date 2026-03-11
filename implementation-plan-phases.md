# SatsFlow Implementation Plan (Phased)

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

---

## Phase 5 - Transaction Safety (Post-Conditions)
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

---

## Phase 6 - Testnet Deployment and Verification
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
- Keep scope to MVP (single sender -> single recipient streams).
- Prefer explicit errors over silent failures.
- Maintain deterministic integer accounting.
- Keep contract interfaces stable once frontend integration starts.
- Do not add advanced modules (marketplace, splits, fiat, yield) before MVP completion.

---

## Immediate Next Step
Start with **Phase 0**, then open a Phase 1 contract task list with exact function signatures and error codes before coding.