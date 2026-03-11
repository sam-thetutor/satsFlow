# SatsFlow

SatsFlow is a Bitcoin-native continuous payment streaming app on Stacks.

It lets a sender create a funded stream that pays one or many recipients over time, with each recipient able to withdraw accrued funds at any time.

## What This Repo Contains

- `satsflow-app/`: Next.js frontend (wallet connect, stream create/manage/withdraw flows)
- `satsflow-contracts/`: Clarity smart contracts, tests, deployment plans, and testnet scripts
- `implementation-plan-phases.md`: Build progress and roadmap notes
- `pitch-deck.md`, `pitch-deck-compressed.md`: hackathon pitch materials

## Current Status

- Contract target in frontend: `ST2QFJV445B22TXQXYW0M3EDEYSDGDVV5N15PE2XN.satsflow-streams-v5`
- Multi-recipient streams with per-recipient rates are supported
- Sender and recipient dashboards are implemented
- Recipient detail page is recipient-specific (your rate, withdrawn, allocation, remaining, claimable)

## Core Contract Functions (v5)

Public:
- `create-stream(recipient-entries, token, deposit, name, description)`
- `withdraw(stream-id)`
- `top-up-stream(stream-id, amount)`
- `cancel-stream(stream-id)`

Read-only:
- `get-stream(stream-id)`
- `get-stream-recipients(stream-id)`
- `get-stream-recipient(stream-id, recipient)`
- `get-claimable(stream-id, recipient)`
- `get-sender-streams(sender)`
- `get-recipient-streams(recipient)`

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript
- Wallet: `@stacks/connect`
- Contracts: Clarity + Clarinet
- Network: Stacks testnet

## Local Development

### 1) Frontend

```bash
cd satsflow-app
npm install
npm run dev
```

Open `http://localhost:3000`.

### 2) Smart Contracts

```bash
cd satsflow-contracts
npm install
npm test
```

Optional checks:

```bash
clarinet check
```

## Build

From `satsflow-app/`:

```bash
npm run build
```

The production build uses Webpack (`next build --webpack`) for stable deploy behavior.

## Deploy to Vercel

From `satsflow-app/`:

```bash
vercel --prod --yes
```

If this is your first push from a local branch:

```bash
git push --set-upstream origin main
```

## Testnet Contract Deployment

From `satsflow-contracts/`:

```bash
npm run preflight:testnet
npm run deploy:testnet
npm run smoke:testnet
```

## Notes

- Stream accounting is integer-only.
- Frontend token formatting shows concise decimal output for readability.
- Withdraw/cancel transaction handling is configured to avoid false wallet aborts from restrictive post-condition mode.

## License

No license file is currently defined in this repository.
