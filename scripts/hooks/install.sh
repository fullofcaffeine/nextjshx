#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly GITLEAKS_VERSION="8.30.0"

for command_name in bd git gitleaks haxelib jq python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[hooks] ERROR: $command_name is required." >&2
    exit 1
  fi
done

reported_gitleaks="$(gitleaks version | tr -d '\r\n')"
if [[ "$reported_gitleaks" != "$GITLEAKS_VERSION" ]]; then
  echo "[hooks] ERROR: expected Gitleaks $GITLEAKS_VERSION, found ${reported_gitleaks:-none}." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.beads/hooks/pre-commit" || ! -f "$ROOT_DIR/.beads/hooks/pre-push" ]]; then
  echo "[hooks] ERROR: expected tracked Beads pre-commit and pre-push wrappers." >&2
  exit 1
fi

chmod +x \
  "$ROOT_DIR/.beads/hooks/pre-commit" \
  "$ROOT_DIR/.beads/hooks/pre-push" \
  "$ROOT_DIR/scripts/hooks/pre-commit" \
  "$ROOT_DIR/scripts/hooks/pre-push" \
  "$ROOT_DIR/scripts/hooks/install.sh" \
  "$ROOT_DIR/scripts/beads/push-safe.sh" \
  "$ROOT_DIR/scripts/ci/install-gitleaks.sh" \
  "$ROOT_DIR/scripts/lint/hx_format_guard.sh" \
  "$ROOT_DIR/scripts/lint/local_path_guard_staged.sh" \
  "$ROOT_DIR/scripts/lint/whitespace_guard.sh" \
  "$ROOT_DIR/scripts/security/run-beads-gitleaks.sh" \
  "$ROOT_DIR/scripts/security/run-gitleaks.sh"

bash "$ROOT_DIR/scripts/lint/hx_format_guard.sh" --tool-only
git -C "$ROOT_DIR" config core.hooksPath .beads/hooks
python3 "$ROOT_DIR/scripts/ci/check_security_tooling.py"

echo "[hooks] Installed repository checks through .beads/hooks."
echo "[hooks] Pre-commit formats staged Haxe and scans staged content."
echo "[hooks] Pre-push scans full Git history and decoded Beads history."
echo "[hooks] Use npm run beads:push for audited Dolt synchronization."
