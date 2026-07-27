#!/usr/bin/env bash
set -euo pipefail

readonly BEADS_VERSION="1.1.0"
readonly BEADS_COMMIT="7eb428cde13c6d2c4743a76533be8df2d418aff5"
readonly BEADS_ARCHIVE_SHA256="c2903ff26ca0554a1edf0551094ec4ce30ccfd1595aa746944633995f2801ec6"
readonly BEADS_ARCHIVE_URL="https://github.com/gastownhall/beads/archive/${BEADS_COMMIT}.tar.gz"
readonly BEADS_BUILD_LABEL="nextjshx-pinned"

usage() {
  cat <<'USAGE'
Usage: scripts/ci/install-beads.sh --install-dir DIR [--archive FILE]

Builds the reviewed Beads commit that fixes NULL values in migrated Dolt
history. --archive permits an already-downloaded archive, but its SHA-256 is
still verified before extraction.
USAGE
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "[beads-install] ERROR: sha256sum or shasum is required." >&2
    return 1
  fi
}

install_dir=""
archive=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      if [[ $# -lt 2 ]]; then
        echo "[beads-install] ERROR: --install-dir requires a value." >&2
        exit 1
      fi
      install_dir="$2"
      shift 2
      ;;
    --archive)
      if [[ $# -lt 2 ]]; then
        echo "[beads-install] ERROR: --archive requires a value." >&2
        exit 1
      fi
      archive="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[beads-install] ERROR: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$install_dir" ]]; then
  echo "[beads-install] ERROR: --install-dir is required." >&2
  exit 1
fi
if ! command -v go >/dev/null 2>&1; then
  echo "[beads-install] ERROR: Go is required to build the pinned Beads source." >&2
  exit 1
fi

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/nextjshx-beads-install.XXXXXX")"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

if [[ -z "$archive" ]]; then
  archive="$tmp_dir/beads.tar.gz"
  curl --fail --location --silent --show-error "$BEADS_ARCHIVE_URL" --output "$archive"
elif [[ ! -f "$archive" ]]; then
  echo "[beads-install] ERROR: archive does not exist: $archive" >&2
  exit 1
fi

actual_sha256="$(sha256_file "$archive")"
if [[ "$actual_sha256" != "$BEADS_ARCHIVE_SHA256" ]]; then
  echo "[beads-install] ERROR: checksum mismatch for the pinned Beads source." >&2
  echo "[beads-install] expected: $BEADS_ARCHIVE_SHA256" >&2
  echo "[beads-install] actual:   $actual_sha256" >&2
  exit 1
fi

tar -xzf "$archive" -C "$tmp_dir"
source_dir="$tmp_dir/beads-$BEADS_COMMIT"
binary="$tmp_dir/bd"
(
  cd "$source_dir"
  CGO_ENABLED=1 GOFLAGS=-tags=gms_pure_go go build \
    -trimpath \
    -ldflags="-X main.Build=$BEADS_BUILD_LABEL -X main.Commit=$BEADS_COMMIT -X main.Branch=main" \
    -o "$binary" \
    ./cmd/bd
)

expected_version="bd version $BEADS_VERSION ($BEADS_BUILD_LABEL: main@${BEADS_COMMIT:0:12})"
reported_version="$("$binary" version 2>/dev/null | tr -d '\r\n')"
if [[ "$reported_version" != "$expected_version" ]]; then
  echo "[beads-install] ERROR: pinned binary reported an unexpected identity." >&2
  echo "[beads-install] expected: $expected_version" >&2
  echo "[beads-install] actual:   ${reported_version:-none}" >&2
  exit 1
fi

mkdir -p "$install_dir"
install -m 0755 "$binary" "$install_dir/bd"
echo "[beads-install] Verified Beads $BEADS_VERSION at $BEADS_COMMIT ($BEADS_ARCHIVE_SHA256)"
