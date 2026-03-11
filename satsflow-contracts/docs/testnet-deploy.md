# Testnet Deployment and Smoke Scripts

## Prerequisite
Update `settings/Testnet.toml` with a valid deployer secret:
- `mnemonic = "..."` OR
- `encrypted_mnemonic = "..."`

## Commands
- Preflight checks + testnet plan generation:
  - `npm run preflight:testnet`
- Deploy to testnet:
  - `npm run deploy:testnet`
- Validate deployed interface exposes required functions:
  - `npm run smoke:testnet -- <CONTRACT_ID>`

If `deploy:testnet` can detect the contract id from deployment logs, it stores it in `.last-deployed-contract-id` and then you can run:
- `npm run smoke:testnet`

## What Smoke Check Verifies
The smoke script checks the Hiro testnet contract interface for expected functions.

Public:
- `create-stream`
- `withdraw`
- `top-up-stream`
- `cancel-stream`

Read-only:
- `get-stream`
- `get-claimable`
- `get-sender-streams`
- `get-recipient-streams`
