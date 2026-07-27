#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"

echo "[beads-push] Scanning reachable Git and Dolt refs before publication..."
bash "$ROOT_DIR/scripts/security/run-gitleaks.sh"

echo "[beads-push] Scanning decoded current and historical Beads records..."
bash "$ROOT_DIR/scripts/security/run-beads-gitleaks.sh"

echo "[beads-push] Pushing the audited Dolt history..."
"$ROOT_DIR/.cache/beads-bin/bd" -C "$ROOT_DIR" dolt push "$@"
