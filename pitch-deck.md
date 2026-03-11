# SatsFlow Pitch Deck

## 1. One-Liner
SatsFlow lets teams and creators fund continuous Bitcoin-backed payouts on Stacks, so contributors can watch earnings accrue every second and withdraw whenever they want.

## 2. Problem
Contributors and creators are still paid in rigid payout cycles.

- Teams run weekly or monthly payouts even when work happens continuously.
- Contributors wait for money they have already earned.
- Cross-border payouts are slow and operationally painful.
- Centralized platforms control timing, fee extraction, and access to funds.
- Existing crypto tools are often too generic or too complex for simple contributor payments.

The mismatch is clear: internet-native work is continuous, but payment rails are still periodic.

## 3. Solution
SatsFlow introduces continuous payout streams with per-second accrual and on-demand settlement.

- A payer creates and funds a stream.
- The contract stores stream terms and payout rate.
- The UI shows live accrual in real time.
- The recipient withdraws accrued value at any time.
- Settlement is transparent, deterministic, and self-custodied.

This turns contributor compensation from payout cliffs into continuous earning.

## 4. Why Now
The Stacks ecosystem is actively focused on activating the Bitcoin economy.

- sBTC unlocks Bitcoin-backed programmability.
- Builders are encouraged to ship practical Bitcoin-native applications.
- Teams and creators need better payout rails today, not another speculative primitive.
- The hackathon rewards Stacks alignment, technical depth, user experience, and impact.

SatsFlow lands exactly in that window.

## 5. Why Stacks
SatsFlow is a Stacks-native product by design, not by deployment convenience.

- Stacks is the app layer aligned with Bitcoin.
- sBTC enables Bitcoin-backed payment flows.
- Clarity contracts make payout logic explicit and auditable.
- Users keep custody while interacting with programmable rails.

This is the right chain-product fit for continuous Bitcoin-backed monetization.

## 6. Product Vision
Enable contributors to earn value continuously, as work happens.

Longer-term expansion includes:
- creator collectives
- open-source maintainer payouts
- grant disbursement streams
- API or service monetization rails

The first version stays focused on one high-signal use case: team-to-contributor streams.

## 7. MVP Scope
### Core user
Teams paying contributors.

### Core experience
- Per-second accrual (UX)
- On-demand withdrawal (contract settlement)
- Bitcoin-backed positioning

### Asset strategy
- Primary: sBTC
- Stretch: USDCx if low-risk to integrate

### Included
- Single sender -> single recipient stream
- Stream creation and funding
- Live accrual display
- Recipient withdrawal
- Sender top-up
- Sender cancellation and refund of unaccrued funds

### Excluded
- Subscription billing module
- Multi-recipient split streams
- Creator marketplace/discovery
- Fiat conversion and oracles
- Yield routing and advanced automation

## 8. Smart Contract Design
### Stream state
- `stream_id`
- `sender`
- `recipient`
- `token`
- `deposit`
- `rate_per_second`
- `start_timestamp`
- `last_withdraw_timestamp`
- `total_withdrawn`
- `is_active`
- optional `title` and `description`

### Contract functions
- `create-stream(sender, recipient, token, rate-per-second, deposit, title, description)`
- `get-stream(stream-id)`
- `get-claimable(stream-id, recipient)`
- `withdraw(stream-id)`
- `top-up-stream(stream-id, amount)`
- `cancel-stream(stream-id)`
- `get-sender-streams(sender)`
- `get-recipient-streams(recipient)`

### Contract rules
- Integer-only math.
- Claimable = elapsed time x rate per second.
- Claimable is capped by remaining deposit.
- Only sender can create, top up, cancel.
- Only recipient can withdraw.
- Positive deposit and rate are mandatory.
- Inactive streams cannot be used.

## 9. Frontend Scope
### Landing page
- Product statement
- Problem/solution in plain language
- Live visual accrual effect
- CTA: Create stream
- CTA: Receive payouts

### Create Stream page
- Wallet connect
- Token selection
- Recipient input
- Amount and cadence input
- Auto-convert cadence to per-second rate
- Deposit input and summary
- Submit transaction

### Sender Dashboard
- Active streams
- Remaining runway
- Total paid
- Top up action
- Cancel action

### Recipient Dashboard
- Incoming streams
- Live accrued amount
- Withdraw action
- Total claimed
- Last withdrawal

### Stream Detail page
- Stream terms
- Current accrued value
- Remaining deposit
- Start and last withdrawal timestamps
- Status and basic history

## 10. UX Integrity
SatsFlow is intentionally honest in its design:
- accrual appears continuous in the UI
- settlement is executed on-chain when withdrawal is called

This framing is technically credible and still delivers a powerful user experience.

## 11. Demo Script
### Flow A: Payer creates stream
1. Open landing page and state the problem in one sentence.
2. Connect payer wallet.
3. Create a stream in sBTC to a contributor.
4. Show stream confirmation and terms.

### Flow B: Recipient withdraws
1. Switch to recipient wallet.
2. Open recipient dashboard.
3. Show live accrued amount increasing.
4. Open stream detail and show claimable balance.
5. Withdraw accrued value.
6. Show updated remaining balance and claimed amount.

### Optional stretch
- Show sender top-up.
- Show USDCx token path if verified and stable.

## 12. Target Users
- Remote-first teams with contributors
- Creator collectives sharing treasury payouts
- Open-source teams paying maintainers
- Grant-funded groups managing transparent disbursements

## 13. Competitive Positioning
SatsFlow is not a full HR/payroll suite. It is a focused payment primitive.

- Built for continuous contributor payouts
- Bitcoin-backed and Stacks-native
- Self-custodied and transparent
- Easier to reason about than broad DeFi protocols

## 14. Why This Can Win
### Innovation
Continuous Bitcoin-backed contributor payouts are practical and differentiated.

### Technical implementation
Working contract, funding flow, accrual logic, and recipient withdrawal prove depth.

### Stacks alignment
Directly activates Bitcoin capital through a real application.

### User experience
Live accrual + simple withdraw flow creates immediate product clarity.

### Impact potential
Useful beyond hackathon context for real contributor and creator economics.

## 15. Bounty Fit
### Primary: Most Innovative Use of sBTC
SatsFlow uses sBTC as productive payment infrastructure, not passive collateral.

### Secondary: Best Use of USDCx
If USDCx support is stable, same architecture supports predictable stable-value payouts.

## 16. Go-To-Market (Post-Hackathon)
### Initial wedge
- Stacks-native teams
- Open-source contributor networks
- Creator collectives
- Grant-driven organizations

### Distribution
- Hackathon showcase
- Ecosystem partner intros
- Direct onboarding of contributor teams
- Open SDK/docs for integration

## 17. Roadmap
### Phase 1
- Single-recipient streams
- sBTC path
- Top-up/cancel
- Dashboard and live accrual

### Phase 2
- USDCx support
- Better reporting and exports
- Stream history and analytics

### Phase 3
- Multi-recipient splits
- Creator-specific modules
- API-driven streaming integrations

## 18. Name and Brand Direction
### Recommended name: SatsFlow
Why it works:
- Bitcoin-native signal (sats)
- Conveys continuous movement (flow)
- Memorable and pitch-friendly

### Alternatives
- TidePay
- DriftBTC

### Taglines
- Continuous Bitcoin payouts for contributors
- Stream value, not payroll delays
- Bitcoin-backed earnings, second by second

## 19. Exact Hackathon Pitch
### Problem
Contributors and creators still get paid in rigid cycles, forcing people to wait for earnings they have already generated while teams handle manual payout operations.

### Solution
SatsFlow is a Stacks-native app where a payer funds a stream once, contributors watch earnings accrue every second, and recipients withdraw on demand through transparent smart contract settlement.

### Why Stacks
Stacks is the Bitcoin app layer. It gives us Bitcoin-backed asset utility via sBTC, explicit contract logic via Clarity, and a self-custodied payout model aligned with the Bitcoin economy thesis.

### Why Now
Stacks is in an ecosystem phase focused on activating Bitcoin capital through real applications. Continuous contributor payouts are a high-signal, real-world use case that is simple to understand and useful beyond speculation.

### Bounty Fit
SatsFlow is purpose-built for Most Innovative Use of sBTC by turning sBTC into practical payment infrastructure for teams and creators.

## 20. Closing
SatsFlow makes work compensation feel internet-native: continuous, global, and always on. Fund once, accrue continuously, withdraw anytime. This is a concrete step toward activating the Bitcoin economy on Stacks.












