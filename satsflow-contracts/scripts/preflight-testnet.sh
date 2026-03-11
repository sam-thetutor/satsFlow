#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TESTNET_FILE="$ROOT_DIR/settings/Testnet.toml"

if [[ ! -f "$TESTNET_FILE" ]]; then
  echo "Missing settings/Testnet.toml"
  exit 1
fi

if grep -q "<YOUR PRIVATE TESTNET MNEMONIC HERE>" "$TESTNET_FILE"; then
  echo "Testnet mnemonic is still placeholder in settings/Testnet.toml"
  echo "Set either 'mnemonic' or 'encrypted_mnemonic' before deployment."
  exit 1
fi

echo "Running contract checks..."
cd "$ROOT_DIR"
clarinet check

echo "Generating testnet deployment plan..."
printf 'y\n' | clarinet deployments generate --testnet --medium-cost

echo "Preflight complete. Ready to deploy."
