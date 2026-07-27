#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly GITLEAKS_VERSION="8.30.0"
readonly BEADS_VERSION="1.1.0"
readonly BEADS_COMMIT="7eb428cde13c6d2c4743a76533be8df2d418aff5"
readonly BEADS_BUILD_LABEL="nextjshx-pinned"
readonly DEFAULT_BD_BIN="$ROOT_DIR/.cache/beads-bin/bd"
BD_BIN="${NEXTJSHX_BD_BIN:-$DEFAULT_BD_BIN}"

for command_name in jq gitleaks; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[beads-gitleaks] ERROR: $command_name is required." >&2
    exit 1
  fi
done

if [[ ! -x "$BD_BIN" ]]; then
  echo "[beads-gitleaks] ERROR: the reviewed Beads binary is missing: $BD_BIN" >&2
  echo "[beads-gitleaks] Run npm run beads:install-pinned, then retry." >&2
  exit 1
fi

expected_bd_version="bd version $BEADS_VERSION ($BEADS_BUILD_LABEL: main@${BEADS_COMMIT:0:12})"
reported_bd_version="$("$BD_BIN" version 2>/dev/null | tr -d '\r\n')"
if [[ "$reported_bd_version" != "$expected_bd_version" ]]; then
  echo "[beads-gitleaks] ERROR: expected $expected_bd_version, found ${reported_bd_version:-none}." >&2
  echo "[beads-gitleaks] Run npm run beads:install-pinned to restore the reviewed binary." >&2
  exit 1
fi

reported_version="$(gitleaks version | tr -d '\r\n')"
if [[ "$reported_version" != "$GITLEAKS_VERSION" ]]; then
  echo "[beads-gitleaks] ERROR: expected Gitleaks $GITLEAKS_VERSION, found ${reported_version:-none}." >&2
  exit 1
fi

if ! "$BD_BIN" -C "$ROOT_DIR" context >/dev/null 2>&1; then
  echo "[beads-gitleaks] ERROR: the repository Beads database is unavailable." >&2
  exit 1
fi

issue_ids="$(
  "$BD_BIN" -C "$ROOT_DIR" export --all |
    jq -r 'select(type == "object" and ._type == "issue" and (.id | type == "string")) | .id'
)"
issue_count="$(printf '%s\n' "$issue_ids" | awk 'NF { count++ } END { print count + 0 }')"

echo "[beads-gitleaks] Scanning current records and the decoded history of $issue_count issues"
umask 077
decoded_history="$(mktemp "${TMPDIR:-/tmp}/nextjshx-beads-history.XXXXXX")"
cleanup() {
  rm -f "$decoded_history"
}
trap cleanup EXIT

"$BD_BIN" -C "$ROOT_DIR" export --all >"$decoded_history"
while IFS= read -r issue_id; do
  if [[ -z "$issue_id" ]]; then
    continue
  fi
  if ! history_json="$("$BD_BIN" -C "$ROOT_DIR" history "$issue_id" --json 2>&1)"; then
    if [[ "$history_json" == *"converting NULL to string is unsupported"* ]]; then
      echo "[beads-gitleaks] ERROR: bd cannot decode migrated history for $issue_id because of upstream beads issue #4867." >&2
      echo "[beads-gitleaks] Refusing to skip Dolt history. Use a beads build containing the NULL-history fix from PR #4912, then rerun this gate." >&2
    else
      echo "[beads-gitleaks] ERROR: bd failed to decode history for $issue_id; refusing a partial security scan." >&2
    fi
    exit 1
  fi
  printf '%s\n' "$history_json" >>"$decoded_history"
done <<<"$issue_ids"

gitleaks stdin \
  --redact \
  --config "$ROOT_DIR/.gitleaks.toml" \
  --no-banner <"$decoded_history"

echo "[beads-gitleaks] OK"
