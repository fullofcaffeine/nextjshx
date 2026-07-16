#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

STAGED_ADDED_LINES="$(
  git diff --cached --unified=0 --no-color -- . |
    awk '
      /^diff --git / { file = ""; next }
      /^\+\+\+ / {
        file = $2
        if (file == "/dev/null") {
          file = ""
        } else {
          sub(/^[a-z]\//, "", file)
        }
        next
      }
      /^\+/ && $0 !~ /^\+\+\+/ && file != "" {
        print file ":" substr($0, 2)
      }
    '
)"

if [[ -z "$STAGED_ADDED_LINES" ]]; then
  exit 0
fi

# Split the path prefixes so the guard does not match its own source while it
# is first introduced. Portable documented sibling paths such as ../genes are
# allowed; this gate targets workstation-specific absolute paths.
mac_home="/""Users/"
linux_home="/""home/"
mac_temp="/""var/folders/"
mac_private_temp="/""private/var/folders/"
windows_home="[A-Za-z]:\\\\U""sers\\\\"
windows_mount="/""mnt/[A-Za-z]/Users/"
ABSOLUTE_LOCAL_PATTERN="(${mac_home}[^[:space:]\"'<>()[\\]{}]+|${linux_home}[^[:space:]\"'<>()[\\]{}]+|${mac_temp}[^[:space:]\"'<>()[\\]{}]+|${mac_private_temp}[^[:space:]\"'<>()[\\]{}]+|${windows_home}[^[:space:]\"'<>()[\\]{}]+|${windows_mount}[^[:space:]\"'<>()[\\]{}]+)"

if command -v rg >/dev/null 2>&1; then
  HITS="$(printf '%s\n' "$STAGED_ADDED_LINES" | rg -n -P "$ABSOLUTE_LOCAL_PATTERN" || true)"
else
  HITS="$(printf '%s\n' "$STAGED_ADDED_LINES" | grep -En "$ABSOLUTE_LOCAL_PATTERN" || true)"
fi

if [[ -n "$HITS" ]]; then
  echo "[guard:local-paths] ERROR: machine-local absolute filesystem paths detected." >&2
  echo "[guard:local-paths] Use a repository-relative path, variable, or sanitized placeholder." >&2
  echo "$HITS" >&2
  exit 1
fi

echo "[guard:local-paths] OK"
