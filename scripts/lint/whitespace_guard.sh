#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

PATHS=(
  .
  ':(exclude)vendor/**'
  ':(exclude)third_party/**'
  ':(exclude)runtime/vendor/**'
  ':(exclude)runtime/third_party/**'
)

case "${1:-}" in
"")
  git diff --check -- "${PATHS[@]}"
  ;;
--staged)
  git diff --cached --check -- "${PATHS[@]}"
  ;;
--tracked)
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    EMPTY_TREE="$(git hash-object -t tree /dev/null)"
    git diff --check "$EMPTY_TREE" HEAD -- "${PATHS[@]}"
  else
    git diff --cached --check -- "${PATHS[@]}"
  fi
  ;;
*)
  echo "usage: $0 [--staged|--tracked]" >&2
  exit 2
  ;;
esac

echo "[guard:whitespace] OK"
