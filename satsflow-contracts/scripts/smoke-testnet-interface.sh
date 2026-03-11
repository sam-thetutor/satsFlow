#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACT_ID="${1:-}"

if [[ -z "$CONTRACT_ID" && -f "$ROOT_DIR/.last-deployed-contract-id" ]]; then
  CONTRACT_ID="$(cat "$ROOT_DIR/.last-deployed-contract-id")"
fi

if [[ -z "$CONTRACT_ID" ]]; then
  echo "Usage: $0 <CONTRACT_ID>"
  echo "Example: $0 ST123...XYZ.satsflow-streams"
  exit 1
fi

ADDRESS="${CONTRACT_ID%%.*}"
NAME="${CONTRACT_ID#*.}"

if [[ "$ADDRESS" == "$NAME" ]]; then
  echo "Invalid contract id: $CONTRACT_ID"
  exit 1
fi

URL="https://api.testnet.hiro.so/v2/contracts/interface/$ADDRESS/$NAME"
echo "Fetching contract interface from: $URL"
INTERFACE_JSON="$(curl -sSf "$URL")"

assert_contains() {
  local needle="$1"
  if ! grep -q "$needle" <<< "$INTERFACE_JSON"; then
    echo "Missing function in testnet interface: $needle"
    exit 1
  fi
}

# Public functions
assert_contains '"create-stream"'
assert_contains '"withdraw"'
assert_contains '"top-up-stream"'
assert_contains '"cancel-stream"'

# Read-only functions
assert_contains '"get-stream"'
assert_contains '"get-stream-recipients"'
assert_contains '"get-stream-recipient"'
assert_contains '"get-claimable"'
assert_contains '"get-sender-streams"'
assert_contains '"get-recipient-streams"'

echo "Smoke check passed: expected functions are present in deployed interface."
