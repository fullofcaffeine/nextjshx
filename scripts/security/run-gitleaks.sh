#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
MODE="full"
readonly GITLEAKS_VERSION="8.30.0"
readonly DOLT_REMOTE_REF="refs/dolt/data"
readonly DOLT_LOCAL_REF="refs/remotes/origin/dolt/data"

case "${1:-}" in
"") ;;
--staged) MODE="staged" ;;
*)
  echo "usage: $0 [--staged]" >&2
  exit 2
  ;;
esac

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[gitleaks] ERROR: Gitleaks $GITLEAKS_VERSION is required." >&2
  echo "[gitleaks] Install: https://github.com/gitleaks/gitleaks#installing" >&2
  exit 1
fi

reported_version="$(gitleaks version | tr -d '\r\n')"
if [[ "$reported_version" != "$GITLEAKS_VERSION" ]]; then
  echo "[gitleaks] ERROR: expected Gitleaks $GITLEAKS_VERSION, found ${reported_version:-none}." >&2
  exit 1
fi

CONFIG_ARGS=(--config "$ROOT_DIR/.gitleaks.toml")

if [[ "$MODE" == "staged" ]]; then
  echo "[gitleaks] Scanning staged content with Gitleaks $GITLEAKS_VERSION"
  (
    cd "$ROOT_DIR"
    gitleaks git --staged --redact "${CONFIG_ARGS[@]}" .
  )
  exit 0
fi

if git -C "$ROOT_DIR" remote get-url origin >/dev/null 2>&1; then
  set +e
  GIT_TERMINAL_PROMPT=0 git -C "$ROOT_DIR" ls-remote \
    --exit-code --refs origin "$DOLT_REMOTE_REF" >/dev/null 2>&1
  DOLT_LOOKUP_STATUS=$?
  set -e
  case "$DOLT_LOOKUP_STATUS" in
  0)
    echo "[gitleaks] Fetching the remote Beads Dolt ref for audit"
    GIT_TERMINAL_PROMPT=0 git -C "$ROOT_DIR" fetch \
      --no-tags --force origin "$DOLT_REMOTE_REF:$DOLT_LOCAL_REF"
    ;;
  2)
    echo "[gitleaks] No remote Beads Dolt ref is advertised"
    ;;
  *)
    echo "[gitleaks] ERROR: could not inspect origin for $DOLT_REMOTE_REF." >&2
    exit 1
    ;;
  esac
else
  echo "[gitleaks] No origin remote is configured; scanning local refs only"
fi

echo "[gitleaks] Scanning every reachable Git revision with Gitleaks $GITLEAKS_VERSION"
echo "[gitleaks] Reachable commits: $(git -C "$ROOT_DIR" rev-list --all --count)"
(
  cd "$ROOT_DIR"
  gitleaks git . --redact --log-opts="--all" "${CONFIG_ARGS[@]}"
)
