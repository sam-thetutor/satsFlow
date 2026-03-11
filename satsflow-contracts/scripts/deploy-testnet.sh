#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT_DIR/scripts/preflight-testnet.sh"

cd "$ROOT_DIR"
echo "Applying testnet deployment..."
DEPLOY_LOG="$(mktemp)"
printf 'y\n' | clarinet deployments apply --testnet --no-dashboard --use-on-disk-deployment-plan | tee "$DEPLOY_LOG"

CONTRACT_ID="$(grep -Eo "S[PT][A-Z0-9]{38,41}\.satsflow-streams(-v[0-9]+)?" "$DEPLOY_LOG" | tail -n 1 || true)"

if [[ -n "$CONTRACT_ID" ]]; then
  echo "Detected contract ID: $CONTRACT_ID"
  echo "$CONTRACT_ID" > "$ROOT_DIR/.last-deployed-contract-id"
  echo "Saved to .last-deployed-contract-id"
else
  echo "Could not automatically detect contract ID from output."
  echo "Copy the published contract ID from deploy logs manually."
fi

echo "Deployment complete."
