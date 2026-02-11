#!/usr/bin/env bash
# Deploy Among Claws contracts to Monad mainnet
#
# Usage:
#   PRIVATE_KEY=0x... ./deploy-monad.sh
#
# Requires:
#   - Foundry (forge)
#   - PRIVATE_KEY env var with funded Monad wallet

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -z "${PRIVATE_KEY:-}" ]; then
  # Try loading from engine .env
  if [ -f "../engine/.env" ]; then
    PRIVATE_KEY=$(grep OPERATOR_PRIVATE_KEY ../engine/.env | cut -d'=' -f2)
  fi
fi

if [ -z "${PRIVATE_KEY:-}" ] || [ "$PRIVATE_KEY" = "0x_your_private_key_here" ]; then
  echo "ERROR: Set PRIVATE_KEY env var or OPERATOR_PRIVATE_KEY in engine/.env"
  exit 1
fi

echo ""
echo "  Deploying Among Claws to Monad (Chain 143)"
echo "  RPC: https://rpc.monad.xyz"
echo ""

# Build first
forge build

# Deploy
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.monad.xyz \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy \
  -vvv

echo ""
echo "  Deployment complete!"
echo "  Copy the contract addresses above into engine/.env"
echo ""

# Verify contracts using the Monad agent verification API
echo "  Verifying contracts..."
echo "  (You can also manually verify via: POST https://agents.devnads.com/v1/verify)"
echo ""
