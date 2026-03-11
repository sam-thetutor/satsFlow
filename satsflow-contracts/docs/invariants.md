# SatsFlow Security Invariants

## Access Control
- Only stream sender can call `top-up-stream` and `cancel-stream`.
- Only stream recipient can call `withdraw`.
- Unauthorized callers must fail with `ERR_UNAUTHORIZED`.

## Input Validity
- `create-stream` requires:
  - supported token (`sBTC` or `STX`)
  - `deposit > 0`
  - `rate-per-second > 0`
  - `recipient != sender`
  - recipient must be a standard principal (`is-standard`)
- `top-up-stream` requires `amount > 0`.

## Lifecycle Rules
- A stream begins as active.
- A stream becomes inactive when:
  - sender cancels it, or
  - recipient withdraws the final claimable amount that exhausts deposit.
- Inactive streams cannot be withdrawn, topped up, or canceled.

## Accounting and Accrual
- All accounting is integer-only.
- `claimable = min(accrued_since_last_withdraw, remaining_deposit)`.
- `remaining_deposit = deposit - total_withdrawn`, floor at zero.
- Over-withdraw must never be possible.

## Settlement Safety
- Withdrawal transfers only computed claimable amount to recipient.
- Cancel flow transfers:
  - accrued claimable to recipient,
  - unaccrued remainder to sender.
- Net outflow on cancel equals current remaining deposit.

## Index Integrity
- Every successful stream creation appends stream id to:
  - sender index (`get-sender-streams`)
  - recipient index (`get-recipient-streams`)
- Index append must fail safely on overflow (`ERR_INDEX_FULL`).

## Error Stability
- Error code meanings are stable and explicit.
- New invariants should add new codes, not repurpose existing ones.
