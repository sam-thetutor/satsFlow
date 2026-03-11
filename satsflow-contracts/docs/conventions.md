# SatsFlow Contract Conventions

## Naming
- Contract names: kebab-case (example: `satsflow-streams`).
- Public and read-only functions: kebab-case.
- Local variables and constants: snake_case.
- Error constants: `ERR_*` uppercase.

## Error Code Policy
- Use sequential, stable unsigned integer codes.
- Reserve ranges by category:
  - `u100-u149`: validation errors
  - `u150-u199`: authorization errors
  - `u200-u249`: stream lifecycle errors
  - `u250-u299`: token transfer/integration errors
- Never reuse an old code for a different meaning.

## Function Layout
- Validation first (`asserts!`, `unwrap!`, `try!`).
- Authorization checks before any state mutation.
- Token transfer calls before final state writes where possible.
- Return explicit `ok`/`err` responses for all public functions.

## State and Math
- Integer-only accounting.
- All accrued values must be capped by remaining deposit.
- Track `total_withdrawn` and update `last_withdraw_timestamp` atomically.

## Testing
- Every public function requires:
  - at least one happy-path test
  - at least one unauthorized/invalid-path test
- Use multi-account tests for sender and recipient role separation.
- Keep tests deterministic; avoid hidden time assumptions.
