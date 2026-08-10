#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly FORMATTER_VERSION="1.18.0"
MODE="check"

case "${1:-}" in
"") ;;
--write) MODE="write" ;;
--tool-only) MODE="tool-only" ;;
*)
  echo "[guard:hx-format] ERROR: expected --write or --tool-only" >&2
  exit 2
  ;;
esac

if ! command -v haxelib >/dev/null 2>&1; then
  echo "[guard:hx-format] ERROR: haxelib is required." >&2
  exit 1
fi

formatter_help="$(haxelib run formatter --help 2>&1 || true)"
reported_version="$(printf '%s\n' "$formatter_help" | awk '/^Haxe Formatter / {print $3; exit}')"
if [[ "$reported_version" != "$FORMATTER_VERSION" ]]; then
  echo "[guard:hx-format] ERROR: expected formatter $FORMATTER_VERSION, found ${reported_version:-none}." >&2
  echo "[guard:hx-format] Install: haxelib install formatter $FORMATTER_VERSION" >&2
  exit 1
fi

if [[ "$MODE" == "tool-only" ]]; then
  echo "[guard:hx-format] Formatter $FORMATTER_VERSION available."
  exit 0
fi

sources=()
while IFS= read -r -d '' source; do
  sources+=("-s" "$source")
done < <(
  find "$ROOT_DIR/src" "$ROOT_DIR/test" "$ROOT_DIR/tests" "$ROOT_DIR/examples" "$ROOT_DIR/tools" \
    -type f -name '*.hx' \
    -not -path '*/.nextjshx/*' \
    -not -path '*/src-gen/*' \
    -print0 2>/dev/null
)

if [[ "${#sources[@]}" -eq 0 ]]; then
  echo "[guard:hx-format] OK: no Haxe source roots found."
  exit 0
fi

if [[ "$MODE" == "write" ]]; then
  echo "[guard:hx-format] Formatting repository-owned Haxe with formatter $FORMATTER_VERSION..."
  haxelib run formatter "${sources[@]}"
else
  echo "[guard:hx-format] Checking repository-owned Haxe with formatter $FORMATTER_VERSION..."
  haxelib run formatter "${sources[@]}" --check
fi

echo "[guard:hx-format] OK"
