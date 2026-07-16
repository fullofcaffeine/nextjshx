#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly GITLEAKS_VERSION="8.30.0"

for command_name in bd jq gitleaks; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[beads-gitleaks] ERROR: $command_name is required." >&2
    exit 1
  fi
done

reported_version="$(gitleaks version | tr -d '\r\n')"
if [[ "$reported_version" != "$GITLEAKS_VERSION" ]]; then
  echo "[beads-gitleaks] ERROR: expected Gitleaks $GITLEAKS_VERSION, found ${reported_version:-none}." >&2
  exit 1
fi

if ! bd -C "$ROOT_DIR" context >/dev/null 2>&1; then
  echo "[beads-gitleaks] ERROR: the repository Beads database is unavailable." >&2
  exit 1
fi

issue_ids="$(
  bd -C "$ROOT_DIR" export --all |
    jq -r 'select(type == "object" and ._type == "issue" and (.id | type == "string")) | .id'
)"
issue_count="$(printf '%s\n' "$issue_ids" | awk 'NF { count++ } END { print count + 0 }')"

echo "[beads-gitleaks] Scanning current records and the decoded history of $issue_count issues"
{
  bd -C "$ROOT_DIR" export --all
  while IFS= read -r issue_id; do
    if [[ -n "$issue_id" ]]; then
      bd -C "$ROOT_DIR" history "$issue_id" --json
    fi
  done <<<"$issue_ids"
} | gitleaks stdin \
  --redact \
  --config "$ROOT_DIR/.gitleaks.toml" \
  --no-banner

echo "[beads-gitleaks] OK"
