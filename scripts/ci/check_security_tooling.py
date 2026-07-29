#!/usr/bin/env python3
"""Fail closed when leak-prevention or CI supply-chain policy drifts."""

from __future__ import annotations

import fnmatch
import hashlib
import json
import re
import stat
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_ROOT = ROOT / ".github/workflows"
WORKFLOW = WORKFLOW_ROOT / "governance.yml"
DEPENDABOT = ROOT / ".github/dependabot.yml"
INSTALLER = ROOT / "scripts/ci/install-gitleaks.sh"
BEADS_INSTALLER = ROOT / "scripts/ci/install-beads.sh"
GITLEAKS_CONFIG = ROOT / ".gitleaks.toml"
PACKAGE = ROOT / "package.json"
PACKAGE_LOCK = ROOT / "package-lock.json"
LICENSE = ROOT / "LICENSE"
README = ROOT / "README.md"
DOCS_ROOT = ROOT / "docs"
DOCS_INDEX = DOCS_ROOT / "README.md"
CLI_PACKAGE = ROOT / "tools/cli/package.json"
CLI_TSCONFIG = ROOT / "tools/cli/tsconfig.json"
CLI_RUNTIME_TSCONFIG = ROOT / "tools/cli/tsconfig.runtime.json"
TEST_LANES = ROOT / "config/test-lanes.json"
TEST_LANES_SCHEMA = ROOT / "schemas/test-lanes.schema.json"
CONFIG_SCHEMA = ROOT / "schemas/nextjshx-config.schema.json"
OUTPUT_MANIFEST_SCHEMA = ROOT / "schemas/generated-output-manifest.schema.json"
OUTPUT_TRANSACTION_SCHEMA = ROOT / "schemas/generated-output-transaction.schema.json"
NEXT_ENTRYPOINTS_SCHEMA = ROOT / "schemas/next-public-entrypoints.schema.json"
NEXT_SURFACE_SCHEMA = ROOT / "schemas/next-public-surface.schema.json"
NEXT_SURFACE_FIXTURES_SCHEMA = ROOT / "schemas/next-surface-fixtures.schema.json"
NEXT_BINDING_OVERRIDES_SCHEMA = ROOT / "schemas/next-binding-overrides.schema.json"
NEXT_BINDING_IMPLEMENTATIONS_SCHEMA = (
    ROOT / "schemas/next-binding-implementations.schema.json"
)
NEXT_BINDING_IR_SCHEMA = ROOT / "schemas/next-binding-ir.schema.json"
NEXT_DRIFT_SCHEMA = ROOT / "schemas/next-surface-drift.schema.json"
NEXT_ENTRYPOINTS = ROOT / "config/next-public-entrypoints.json"
NEXT_SURFACE = ROOT / "surface/next-public-surface.json"
NEXT_SURFACE_FIXTURES = ROOT / "tests/next-surface/fixtures.json"
NEXT_BINDING_OVERRIDES = ROOT / "config/next-binding-overrides.json"
NEXT_BINDING_IMPLEMENTATIONS = ROOT / "config/next-binding-implementations.json"
NEXT_BINDING_IR = ROOT / "surface/next-binding-ir.json"
NEXT_DRIFT = ROOT / "surface/next-surface-drift.json"
NEXT_OVERRIDE_SNAPSHOT = ROOT / "tests/snapshots/next-binding-overrides-v1.json"
SERVER_RUNTIME_EXTERN = ROOT / "src/nextjs/raw/ServerRuntime.hx"
HAXERC = ROOT / ".haxerc"
GENES_LOCK = ROOT / "haxe_libraries/genes-ts.hxml"
HELDER_LOCK = ROOT / "haxe_libraries/helder.set.hxml"
HAXE_FIXTURES = ROOT / "tests/haxe/fixtures.json"
HAXE_FIXTURES_SCHEMA = ROOT / "schemas/haxe-fixtures.schema.json"
PACKAGE_SHAPE_ARTIFACT = ROOT / "tests/package-shape/npm-artifact/package.json"
PACKAGE_SHAPE_TSCONFIG = ROOT / "tests/package-shape/consumer/tsconfig.json"
COMPILER_GAPS_TS_TSCONFIG = ROOT / "tests/compiler-gaps/tsconfig.typescript.json"
COMPILER_GAPS_CLASSIC_TSCONFIG = ROOT / "tests/compiler-gaps/tsconfig.classic.json"
NEXT_FIXTURE_TSCONFIG = ROOT / "tests/fixtures/next-stable/tsconfig.json"
NEXT_FIXTURE_PACKAGE = ROOT / "tests/fixtures/next-stable/package.json"
NEXT_FIXTURE_CONFIG = ROOT / "tests/fixtures/next-stable/nextjshx.config.json"
NEXT_FIXTURE_HXML = ROOT / "tests/fixtures/next-stable/nextjshx.hxml"
TODO_APP_ROOT = ROOT / "examples/todoapp-next"
TODO_APP_PACKAGE = TODO_APP_ROOT / "package.json"
TODO_APP_CONFIG = TODO_APP_ROOT / "nextjshx.config.json"
TODO_APP_NEXT_CONFIG = TODO_APP_ROOT / "next.config.mjs"
TODO_APP_HXML = TODO_APP_ROOT / "nextjshx.hxml"
TODO_APP_TSCONFIG = TODO_APP_ROOT / "tsconfig.json"
TODO_APP_SEED = TODO_APP_ROOT / "data/seed.tsv"
TODO_APP_README = TODO_APP_ROOT / "README.md"
TODO_FLAGSHIP_DOC = ROOT / "docs/todoapp-flagship.md"
SHOWCASE_UI_ROOT = ROOT / "examples/showcase-ui"
SHOWCASE_UI_PACKAGE = SHOWCASE_UI_ROOT / "package.json"
SHOWCASE_UI_TSCONFIG = SHOWCASE_UI_ROOT / "tsconfig.json"
SHOWCASE_APP_ROOTS = (
    ROOT / "examples/showcase-landing",
    ROOT / "examples/showcase-blog",
    ROOT / "examples/showcase-commerce",
)
MIXED_ADOPTION_ROOT = ROOT / "examples/mixed-adoption"
MIXED_ADOPTION_TSCONFIG = MIXED_ADOPTION_ROOT / "tsconfig.json"
SHOWCASE_DOC = ROOT / "docs/showcases.md"
SHOWCASE_UI_FIXTURE_TSCONFIG = ROOT / "tests/showcase-ui/tsconfig.json"
NEXT_CORE_NAVIGATION_TSCONFIG = ROOT / "tests/next-core-navigation/tsconfig.json"
NEXT_COMPONENTS_TSCONFIG = ROOT / "tests/next-components/tsconfig.json"
NEXT_SERVER_TSCONFIG = ROOT / "tests/next-server/tsconfig.json"
CODECS_TSCONFIG = ROOT / "tests/codecs/tsconfig.json"
METADATA_SEGMENT_TSCONFIG = ROOT / "tests/metadata-segment/tsconfig.json"
ROUTE_HREFS_TSCONFIG = ROOT / "tests/route-hrefs/tsconfig.json"
ENVIRONMENT_BOUNDARIES_TSCONFIG = (
    ROOT / "tests/environment-boundaries/next-app/tsconfig.json"
)
SERVER_FUNCTIONS_TSCONFIG = ROOT / "tests/server-functions/next-app/tsconfig.json"
CACHE_BOUNDARIES_TSCONFIG = ROOT / "tests/cache-boundaries/next-app/tsconfig.json"
EXPECTED_ACTIONS = {
    "actions/checkout": "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
    "actions/setup-node": "249970729cb0ef3589644e2896645e5dc5ba9c38",
}
EXPECTED_GITLEAKS_VERSION = "8.30.0"
EXPECTED_BEADS_VERSION = "1.1.0"
EXPECTED_BEADS_COMMIT = "7eb428cde13c6d2c4743a76533be8df2d418aff5"
EXPECTED_BEADS_ARCHIVE_SHA256 = (
    "c2903ff26ca0554a1edf0551094ec4ce30ccfd1595aa746944633995f2801ec6"
)
EXPECTED_FORMATTER_VERSION = "1.18.0"
EXPECTED_HAXE_VERSION = "4.3.7"
EXPECTED_LIX_VERSION = "17.0.2"
EXPECTED_AJV_VERSION = "8.20.0"
EXPECTED_ESLINT_VERSION = "10.7.0"
EXPECTED_REACT_HOOKS_ESLINT_VERSION = "7.1.1"
EXPECTED_TYPESCRIPT_ESLINT_PARSER_VERSION = "8.64.0"
EXPECTED_NEXT_VERSION = "16.2.12"
EXPECTED_NEXT_UPSTREAM_VERSION = "16.3.0-canary.87"
EXPECTED_NUQS_VERSION = "2.9.1"
EXPECTED_DND_KIT_HELPERS_VERSION = "0.5.0"
EXPECTED_DND_KIT_REACT_VERSION = "0.5.0"
EXPECTED_RECHARTS_VERSION = "3.8.1"
EXPECTED_REDUX_TOOLKIT_VERSION = "2.10.1"
EXPECTED_IMMER_VERSION = "10.2.0"
EXPECTED_PACKAGE_VERSION_PATTERN = (
    r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
EXPECTED_PLAYWRIGHT_VERSION = "1.61.1"
EXPECTED_REACT_VERSION = "19.2.7"
EXPECTED_TYPESCRIPT_VERSION = "6.0.2"
EXPECTED_TYPESCRIPT_SPEC = "npm:@typescript/typescript6@6.0.2"
EXPECTED_POSTCSS_VERSION = "8.5.23"
EXPECTED_BRACE_EXPANSION_VERSION = "5.0.8"
EXPECTED_SHARP_VERSION = "0.35.3"
EXPECTED_NODE_TYPES_VERSION = "20.19.24"
EXPECTED_REACT_TYPES_VERSION = "19.2.17"
EXPECTED_REACT_DOM_TYPES_VERSION = "19.2.3"
EXPECTED_GENES_VERSION = "1.41.0"
EXPECTED_GENES_COMMIT = "8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78"
EXPECTED_HELDER_VERSION = "0.3.1"
EXPECTED_LICENSE = "GPL-3.0-only"
EXPECTED_LICENSE_SHA256 = (
    "9e54404b6d141e4babddd0b36cc6fa39d53cbadfb612653408f880ddfa97edaf"
)
EXPECTED_WORKSPACES = [
    "tools/cli",
    "examples/showcase-ui",
    "examples/showcase-landing",
    "examples/showcase-blog",
    "examples/showcase-commerce",
    "examples/showcase-field-atlas",
    "examples/mixed-adoption",
    "examples/todoapp-next",
]
PUBLIC_PREFLIGHT_COMMAND = (
    "npm run format:haxe:check && npm run lint:whitespace && "
    "npm run security:gitleaks && npm run security:beads-history && "
    "npm run security:audit && npm test"
)
REQUIRED_IGNORES = {
    "node_modules/",
    ".next/",
    "src-gen/",
    "examples/showcase-*/public/styles.css",
    "examples/mixed-adoption/public/styles.css",
    "examples/todoapp-next/public/styles.css",
    "next-env.d.ts",
    "*.tsbuildinfo",
    "dist/",
    "coverage/",
    ".cache/",
    ".env",
    ".env.*",
    "!.env.example",
    ".npmrc",
    ".pypirc",
    ".netrc",
    ".aws/",
    ".gnupg/",
    ".ssh/",
    "credentials.json",
    "service-account*.json",
    "id_rsa",
    "id_ed25519",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.jks",
    "*.keystore",
    ".claude/settings.local.json",
}


class SecurityToolingFailure(RuntimeError):
    pass


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        try:
            label = path.relative_to(ROOT)
        except ValueError:
            label = path
        raise SecurityToolingFailure(f"cannot read {label}: {error}") from error


def read_json(path: Path) -> dict[str, object]:
    try:
        value = json.loads(read_text(path))
    except json.JSONDecodeError as error:
        raise SecurityToolingFailure(f"invalid JSON in {path.name}: {error}") from error
    if not isinstance(value, dict):
        raise SecurityToolingFailure(f"{path.name} must contain a JSON object")
    return value


def require_executable(relative: str) -> None:
    path = ROOT / relative
    try:
        mode = path.stat().st_mode
    except OSError as error:
        raise SecurityToolingFailure(f"cannot stat {relative}: {error}") from error
    if not stat.S_ISREG(mode) or mode & stat.S_IXUSR == 0:
        raise SecurityToolingFailure(f"{relative} must be an executable regular file")


def extract(source: str, pattern: str, label: str) -> str:
    match = re.search(pattern, source)
    if match is None:
        raise SecurityToolingFailure(f"missing {label}")
    return match.group(1)


def validate_installer() -> tuple[str, str]:
    source = read_text(INSTALLER)
    version = extract(
        source, r'readonly GITLEAKS_VERSION="([^"]+)"', "Gitleaks version pin"
    )
    digest = extract(
        source, r'readonly GITLEAKS_SHA256="([0-9a-f]+)"', "Gitleaks digest pin"
    )
    if version != EXPECTED_GITLEAKS_VERSION:
        raise SecurityToolingFailure(
            f"Gitleaks installer must pin {EXPECTED_GITLEAKS_VERSION}, found {version}"
        )
    if re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        raise SecurityToolingFailure("Gitleaks SHA-256 must contain 64 hex digits")
    required_url = (
        'readonly GITLEAKS_DOWNLOAD_URL="https://github.com/gitleaks/gitleaks/'
        'releases/download/v${GITLEAKS_VERSION}/${GITLEAKS_ASSET}"'
    )
    if required_url not in source:
        raise SecurityToolingFailure("Gitleaks must download from its pinned release URL")
    if source.index("actual_sha256=") > source.index('tar -xzf "$archive"'):
        raise SecurityToolingFailure("Gitleaks bytes must be verified before extraction")

    with tempfile.TemporaryDirectory(prefix="nextjshx-security-tooling-") as directory:
        temp_root = Path(directory)
        tampered = temp_root / "tampered.tar.gz"
        destination = temp_root / "bin"
        tampered.write_bytes(b"not the reviewed Gitleaks archive")
        result = subprocess.run(
            [
                "bash",
                str(INSTALLER),
                "--archive",
                str(tampered),
                "--install-dir",
                str(destination),
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 or "checksum mismatch" not in result.stderr:
            raise SecurityToolingFailure("tampered Gitleaks archive was not rejected")
        if (destination / "gitleaks").exists():
            raise SecurityToolingFailure("tampered bytes reached the install path")
    return version, digest


def validate_beads_installer() -> None:
    source = read_text(BEADS_INSTALLER)
    for fragment in (
        f'readonly BEADS_VERSION="{EXPECTED_BEADS_VERSION}"',
        f'readonly BEADS_COMMIT="{EXPECTED_BEADS_COMMIT}"',
        f'readonly BEADS_ARCHIVE_SHA256="{EXPECTED_BEADS_ARCHIVE_SHA256}"',
        'readonly BEADS_BUILD_LABEL="nextjshx-pinned"',
        'CGO_ENABLED=1 GOFLAGS=-tags=gms_pure_go go build',
        '-trimpath',
        "-X main.Commit=$BEADS_COMMIT",
        'install -m 0755 "$binary" "$install_dir/bd"',
    ):
        if fragment not in source:
            raise SecurityToolingFailure(
                f"pinned Beads installer lost required behavior: {fragment}"
            )
    if source.index('actual_sha256=') > source.index('tar -xzf "$archive"'):
        raise SecurityToolingFailure(
            "Beads source bytes must be verified before extraction"
        )

    with tempfile.TemporaryDirectory(prefix="nextjshx-beads-tooling-") as directory:
        temp_root = Path(directory)
        tampered = temp_root / "tampered.tar.gz"
        destination = temp_root / "bin"
        tampered.write_bytes(b"not the reviewed Beads source archive")
        result = subprocess.run(
            [
                "bash",
                str(BEADS_INSTALLER),
                "--archive",
                str(tampered),
                "--install-dir",
                str(destination),
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 or "checksum mismatch" not in result.stderr:
            raise SecurityToolingFailure("tampered Beads source archive was not rejected")
        if (destination / "bd").exists():
            raise SecurityToolingFailure(
                "tampered Beads source unexpectedly produced a binary"
            )


def workflow_files() -> list[Path]:
    try:
        children = list(WORKFLOW_ROOT.iterdir())
    except OSError as error:
        raise SecurityToolingFailure(f"cannot list workflows: {error}") from error
    return sorted(
        (path for path in children if path.suffix in {".yml", ".yaml"}),
        key=lambda path: path.name.encode("utf-8"),
    )


def validate_workflows() -> int:
    action_count = 0
    for path in workflow_files():
        source = read_text(path)
        if "pull_request_target:" in source:
            raise SecurityToolingFailure(
                f"{path.name} must not run untrusted changes with pull_request_target"
            )
        if "write-all" in source or "id-token: write" in source:
            raise SecurityToolingFailure(
                f"{path.name} broadened workflow authority without a reviewed need"
            )
        for line_number, line in enumerate(source.splitlines(), start=1):
            match = re.match(r"^\s*uses:\s*([^\s#]+)", line)
            if match is None or match.group(1).startswith("./"):
                continue
            action = match.group(1)
            if "@" not in action:
                raise SecurityToolingFailure(
                    f"{path.name}:{line_number} external action has no revision"
                )
            name, revision = action.rsplit("@", 1)
            if re.fullmatch(r"[0-9a-f]{40}", revision) is None:
                raise SecurityToolingFailure(
                    f"{path.name}:{line_number} external action must use a full commit SHA"
                )
            expected = EXPECTED_ACTIONS.get(name)
            if expected is None:
                raise SecurityToolingFailure(
                    f"{path.name}:{line_number} {name} is not in the reviewed registry"
                )
            if revision != expected:
                raise SecurityToolingFailure(
                    f"{path.name}:{line_number} {name} drifted from its reviewed commit"
                )
            action_count += 1

    workflow = read_text(WORKFLOW)
    required_fragments = (
        "permissions:\n  contents: read",
        "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
        "  secret-scan:\n",
        "  test-plan:\n",
        "  haxe-format:\n",
        "  compatibility-contract:\n",
        "  next-stable-fixture:\n",
        "  next-stable-declaration-drift:\n",
        "  next-canary-declaration-drift:\n",
        "  baseline-test-harness:\n",
        "  showcase-matrix:\n",
        "  todoapp-production-e2e:\n",
        "  security-tooling:\n",
        "  governance-result:\n",
        'cron: "23 4 * * *"',
        "fetch-depth: 0",
        "bash scripts/ci/install-gitleaks.sh --install-dir",
        "bash scripts/security/run-gitleaks.sh",
        "npx --no-install lix download",
        f"npx --no-install haxelib install formatter {EXPECTED_FORMATTER_VERSION} --quiet",
        "npm run security:audit",
        "npm run test:support-matrix",
        "npm run test:fixture:next-stable",
        "test:fixture:next-stable:turbopack",
        "test:fixture:next-stable:webpack",
        "npm run test:fixture:next-stable:smoke",
        "npm run drift:next:stable",
        "npm run drift:next:upstream",
        f"next@{EXPECTED_NEXT_UPSTREAM_VERSION}",
        "NEXTJSHX_NEXT_PACKAGE_DIR",
        "Next canary declaration drift (non-blocking)",
        "continue-on-error: true",
        'cat "$report" >> "$GITHUB_STEP_SUMMARY"',
        "npm run test:harness",
        "npm run test:showcases",
        "npm run test:example:todoapp",
        "Build and test the production todo app with zero retries",
        'NEXT_TELEMETRY_DISABLED: "1"',
        "npm run test:architecture",
        "npm run test:security-tooling",
        "npm run test:loop:validate",
        "npm run test:loop:explain",
        "--output .nextjshx/testing/plan.json",
        "This plan does not skip any existing required job.",
        "Require every declared governance job to succeed",
    )
    for fragment in required_fragments:
        if fragment not in workflow:
            raise SecurityToolingFailure(
                "governance workflow lost required guard: " + fragment.strip()
            )

    dependabot = read_text(DEPENDABOT)
    for ecosystem in ("package-ecosystem: npm", "package-ecosystem: github-actions"):
        if ecosystem not in dependabot:
            raise SecurityToolingFailure(f"Dependabot lost {ecosystem}")
    return action_count


def validate_gitleaks_config() -> None:
    try:
        config = tomllib.loads(read_text(GITLEAKS_CONFIG))
    except tomllib.TOMLDecodeError as error:
        raise SecurityToolingFailure(f"invalid .gitleaks.toml: {error}") from error
    if config.get("minVersion") != EXPECTED_GITLEAKS_VERSION:
        raise SecurityToolingFailure("Gitleaks config must reject older scanner semantics")
    if config.get("extend") != {"useDefault": True}:
        raise SecurityToolingFailure("Gitleaks must retain the complete default rule set")
    if "allowlist" in config or "rules" in config:
        raise SecurityToolingFailure(
            "the initial public baseline must not contain secret-scan exceptions"
        )


def validate_hook_wiring() -> None:
    pre_commit = read_text(ROOT / "scripts/hooks/pre-commit")
    for fragment in (
        'scripts/lint/hx_format_guard.sh" --tool-only',
        'scripts/testing/test-lanes.mjs" check-staged',
        'scripts/testing/test-lanes.mjs" changed --staged --hook',
        "scripts/lint/local_path_guard_staged.sh",
        'scripts/lint/whitespace_guard.sh" --staged',
        'scripts/security/run-gitleaks.sh" --staged',
        "Validating staged JSON contracts",
        'BD_BIN="$ROOT_DIR/.cache/beads-bin/bd"',
    ):
        if fragment not in pre_commit:
            raise SecurityToolingFailure(f"pre-commit lost required behavior: {fragment}")

    pre_push = read_text(ROOT / "scripts/hooks/pre-push")
    for fragment in (
        'scripts/security/run-gitleaks.sh"',
        'scripts/security/run-beads-gitleaks.sh"',
        "scripts/ci/check_security_tooling.py",
        'npm --prefix "$ROOT_DIR" run test:prepush',
    ):
        if fragment not in pre_push:
            raise SecurityToolingFailure(f"pre-push lost required behavior: {fragment}")
    if "--staged" in pre_push:
        raise SecurityToolingFailure("pre-push must scan full history, not staged content")

    for hook_name, repository_hook in (
        ("pre-commit", "scripts/hooks/pre-commit"),
        ("pre-push", "scripts/hooks/pre-push"),
    ):
        source = read_text(ROOT / ".beads/hooks" / hook_name)
        managed_marker = "# --- BEGIN BEADS INTEGRATION"
        if repository_hook not in source:
            raise SecurityToolingFailure(
                f"active Beads {hook_name} wrapper lost repository checks"
            )
        if managed_marker not in source:
            raise SecurityToolingFailure(
                f"active Beads {hook_name} wrapper lost its managed section"
            )
        if 'PATH="$ROOT_DIR/.cache/beads-bin:$PATH"' not in source:
            raise SecurityToolingFailure(
                f"active Beads {hook_name} wrapper does not prefer the reviewed pinned bd"
            )
        if source.index(repository_hook) > source.index(managed_marker):
            raise SecurityToolingFailure(
                f"repository {hook_name} checks must run before the Beads-managed section"
            )
        if f'"$ROOT_DIR/{repository_hook}" "$@" || exit $?' not in source:
            raise SecurityToolingFailure(
                f"active Beads {hook_name} wrapper does not propagate repository-check failures"
            )

    git_scan = read_text(ROOT / "scripts/security/run-gitleaks.sh")
    for fragment in (
        f'readonly GITLEAKS_VERSION="{EXPECTED_GITLEAKS_VERSION}"',
        'readonly DOLT_REMOTE_REF="refs/dolt/data"',
        "ls-remote",
        "DOLT_REMOTE_REF:$DOLT_LOCAL_REF",
        'gitleaks git . --redact --log-opts="--all"',
    ):
        if fragment not in git_scan:
            raise SecurityToolingFailure(
                f"full-history scan lost required behavior: {fragment}"
            )

    beads_scan = read_text(ROOT / "scripts/security/run-beads-gitleaks.sh")
    for fragment in (
        f'readonly BEADS_COMMIT="{EXPECTED_BEADS_COMMIT}"',
        'readonly DEFAULT_BD_BIN="$ROOT_DIR/.cache/beads-bin/bd"',
        "beads:install-pinned",
        "export --all",
        'history "$issue_id" --json',
        "mktemp",
        "refusing a partial security scan",
        "upstream beads issue #4867",
        "PR #4912",
        "gitleaks stdin",
    ):
        if fragment not in beads_scan:
            raise SecurityToolingFailure(
                f"decoded Beads history scan lost required behavior: {fragment}"
            )

    safe_push = read_text(ROOT / "scripts/beads/push-safe.sh")
    for fragment in (
        "scripts/security/run-gitleaks.sh",
        "scripts/security/run-beads-gitleaks.sh",
        '"$ROOT_DIR/.cache/beads-bin/bd" -C "$ROOT_DIR" dolt push "$@"',
    ):
        if fragment not in safe_push:
            raise SecurityToolingFailure(
                f"Beads publication lost required preflight: {fragment}"
            )

    installer = read_text(ROOT / "scripts/hooks/install.sh")
    for fragment in (
        "core.hooksPath .beads/hooks",
        f'readonly GITLEAKS_VERSION="{EXPECTED_GITLEAKS_VERSION}"',
        "scripts/ci/check_security_tooling.py",
    ):
        if fragment not in installer:
            raise SecurityToolingFailure(f"hook installer lost required behavior: {fragment}")

    path_guard = read_text(ROOT / "scripts/lint/local_path_guard_staged.sh")
    for fragment in (
        "git diff --cached",
        "ABSOLUTE_LOCAL_PATTERN",
        "mac_home=",
        "linux_home=",
        "windows_home=",
    ):
        if fragment not in path_guard:
            raise SecurityToolingFailure(f"local-path guard lost required behavior: {fragment}")


def tracked_paths() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        timeout=30,
    )
    return [path for path in result.stdout.decode("utf-8").split("\0") if path]


def validate_ignores_and_tracked_files() -> int:
    ignored = {
        line.strip()
        for line in read_text(ROOT / ".gitignore").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    missing = sorted(REQUIRED_IGNORES - ignored)
    if missing:
        raise SecurityToolingFailure(
            "credential/build ignore baseline is incomplete: " + ", ".join(missing)
        )

    sensitive_patterns = (
        ".env",
        ".env.*",
        ".npmrc",
        ".pypirc",
        ".netrc",
        "credentials.json",
        "credentials.*.json",
        "service-account*.json",
        "id_rsa",
        "id_rsa.*",
        "id_ed25519",
        "id_ed25519.*",
        "*.pem",
        "*.key",
        "*.p12",
        "*.pfx",
        "*.jks",
        "*.keystore",
        "*.kdbx",
        "*.ovpn",
    )
    paths = tracked_paths()
    sensitive_tracked = []
    for path in paths:
        if path == ".env.example" or path.endswith("/.env.example"):
            continue
        name = Path(path).name
        if any(fnmatch.fnmatchcase(name, pattern) for pattern in sensitive_patterns):
            sensitive_tracked.append(path)
    if sensitive_tracked:
        raise SecurityToolingFailure(
            "credential-shaped files are tracked: " + ", ".join(sensitive_tracked)
        )

    # Assemble prefixes so this checker does not contain a path that its own
    # staged guard would reject.
    local_patterns = (
        re.compile(r"/" + r"Users/[^\s\"'<>()[\]{}]+"),
        re.compile(r"/" + r"home/[^\s\"'<>()[\]{}]+"),
        re.compile(r"/" + r"(?:private/)?var/folders/[^\s\"'<>()[\]{}]+"),
        re.compile(r"[A-Za-z]:\\U" + r"sers\\[^\s\"'<>()[\]{}]+"),
        re.compile(r"/" + r"mnt/[A-Za-z]/Users/[^\s\"'<>()[\]{}]+"),
    )
    path_leaks = []
    scanned = 0
    for relative in paths:
        path = ROOT / relative
        try:
            if path.stat().st_size > 5_000_000:
                continue
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            continue
        scanned += 1
        for line_number, line in enumerate(content.splitlines(), start=1):
            if any(pattern.search(line) for pattern in local_patterns):
                path_leaks.append(f"{relative}:{line_number}")
    if path_leaks:
        raise SecurityToolingFailure(
            "machine-local absolute paths are tracked: " + ", ".join(path_leaks)
        )
    return scanned


def validate_package_contract() -> None:
    package = read_json(PACKAGE)
    if package.get("license") != EXPECTED_LICENSE:
        raise SecurityToolingFailure(
            f"package.json must retain the {EXPECTED_LICENSE} license declaration"
        )
    license_digest = hashlib.sha256(LICENSE.read_bytes()).hexdigest()
    if license_digest != EXPECTED_LICENSE_SHA256:
        raise SecurityToolingFailure(
            "LICENSE must remain the canonical GNU GPL version 3 text"
        )
    if "[GNU General Public License version 3](LICENSE)" not in read_text(README):
        raise SecurityToolingFailure("README must link the GNU GPL version 3 license")
    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        raise SecurityToolingFailure("package.json scripts must be an object")
    expected_scripts = {
        "format:haxe": "bash scripts/lint/hx_format_guard.sh --write",
        "format:haxe:check": "bash scripts/lint/hx_format_guard.sh",
        "lint:whitespace": "bash scripts/lint/whitespace_guard.sh --tracked",
        "security:gitleaks": "bash scripts/security/run-gitleaks.sh",
        "security:gitleaks:staged": "bash scripts/security/run-gitleaks.sh --staged",
        "security:beads-history": "bash scripts/security/run-beads-gitleaks.sh",
        "beads:install-pinned": (
            "bash scripts/ci/install-beads.sh --install-dir .cache/beads-bin"
        ),
        "security:audit": "npm audit --audit-level=moderate",
        "hooks:install": "bash scripts/hooks/install.sh",
        "beads:push": "bash scripts/beads/push-safe.sh",
        "support:docs": "node scripts/compat/support-matrix.mjs docs --write",
        "support:discover": "node scripts/compat/support-matrix.mjs discover",
        "support:require-genes": (
            "node scripts/compat/support-matrix.mjs discover --require-genes"
        ),
        "support:require-upstream": (
            "node scripts/compat/support-matrix.mjs discover --require-upstream"
        ),
        "surface:next:check": "node scripts/bindings/next-surface.mjs check",
        "surface:next:update": "node scripts/bindings/next-surface.mjs update",
        "bindings:next:check": (
            "node scripts/bindings/sync-next-bindings.mjs check"
        ),
        "bindings:next:update": (
            "node scripts/bindings/sync-next-bindings.mjs update"
        ),
        "drift:next:stable": (
            "node scripts/bindings/next-compatibility.mjs stable"
        ),
        "drift:next:upstream": (
            "node scripts/bindings/next-compatibility.mjs upstream"
        ),
        "test:architecture": "python3 scripts/ci/check_architecture_docs.py",
        "test:support-matrix": "node scripts/compat/support-matrix.mjs check",
        "test:security-tooling": "python3 scripts/ci/check_security_tooling.py",
        "test:loop:validate": "node scripts/testing/test-lanes.mjs validate",
        "test:loop:self": (
            "node scripts/testing/test-lanes.mjs self-test && "
            "node --test scripts/testing/test-lanes.test.mjs"
        ),
        "test:cli-preparation": (
            "node --test scripts/testing/cli-build-preparation.test.mjs"
        ),
        "test:loop:explain": "node scripts/testing/test-lanes.mjs explain",
        "test:focused": "node scripts/testing/test-lanes.mjs focused",
        "test:changed": "node scripts/testing/test-lanes.mjs changed",
        "test:smoke": "node scripts/testing/test-lanes.mjs smoke",
        "test:haxe:positive": "node scripts/testing/haxe-fixtures.mjs positive",
        "test:haxe:negative": "node scripts/testing/haxe-fixtures.mjs negative",
        "test:haxe": "node scripts/testing/haxe-fixtures.mjs all",
        "test:adapter-plan": "node scripts/testing/adapter-plan.mjs",
        "test:routes": "node scripts/testing/route-patterns.mjs",
        "test:page-layouts": "node scripts/testing/page-layouts.mjs",
        "test:metadata-segment": "node scripts/testing/metadata-segment.mjs",
        "test:route-handlers": "node scripts/testing/route-handlers.mjs",
        "test:special-files": "node scripts/testing/special-files.mjs",
        "test:proxy": "node scripts/testing/proxy.mjs",
        "test:route-hrefs": "node scripts/testing/route-hrefs.mjs",
        "test:environment-boundaries": (
            "node scripts/testing/environment-boundaries.mjs"
        ),
        "test:clientification-boundaries": (
            "node scripts/testing/clientification-boundaries.mjs"
        ),
        "test:client-components": "node scripts/testing/client-components.mjs",
        "test:mdx-components": "node scripts/testing/mdx-components.mjs",
        "test:content-blocks": "node scripts/testing/content-blocks.mjs",
        "test:dev": "node scripts/testing/dev-loop.mjs",
        "test:server-functions": "node scripts/testing/server-functions.mjs",
        "test:cache-boundaries": "node scripts/testing/cache-boundaries.mjs",
        "test:config-discovery": (
            "npm run test:config --workspace @nextjshx/cli-internal"
        ),
        "test:ownership-preflight": (
            "npm run test:ownership --workspace @nextjshx/cli-internal"
        ),
        "test:publication": (
            "npm run test:publication --workspace @nextjshx/cli-internal"
        ),
        "test:cli": "npm run test:commands --workspace @nextjshx/cli-internal",
        "nextjshx": "npm run cli --workspace @nextjshx/cli-internal --",
        "test:tooling": "npm test --workspace @nextjshx/cli-internal",
        "test:snapshots": "node scripts/testing/snapshots.mjs verify",
        "test:snapshots:update": "node scripts/testing/snapshots.mjs update",
        "test:package-shape": "node scripts/testing/package-shape.mjs",
        "test:compiler-gaps": "node scripts/testing/compiler-gaps.mjs",
        "test:example:mixed-adoption:source": (
            "node scripts/examples/mixed-adoption.mjs source"
        ),
        "test:example:mixed-adoption": (
            "node scripts/examples/mixed-adoption.mjs verify"
        ),
        "example:todoapp:clean": "node scripts/examples/todoapp-next.mjs clean",
        "test:example:todoapp:source": (
            "node scripts/examples/todoapp-next.mjs source"
        ),
        "test:example:todoapp:build": (
            "node scripts/examples/todoapp-next.mjs verify"
        ),
        "test:example:todoapp:smoke": (
            "node scripts/examples/todoapp-next.mjs smoke"
        ),
        "test:example:todoapp:e2e": (
            "playwright test tests/e2e/todoapp-next.spec.mjs "
            "--config playwright.config.mjs"
        ),
        "test:example:todoapp": (
            "npm run test:example:todoapp:build && "
            "npm run test:example:todoapp:smoke && "
            "npm run test:example:todoapp:e2e"
        ),
        "example:showcases:clean": "node scripts/examples/showcases.mjs clean",
        "test:showcases:source": "node scripts/examples/showcases.mjs source",
        "test:showcases": "node scripts/examples/showcases.mjs verify",
        "test:next-surface": "node scripts/testing/next-surface.mjs",
        "test:next-bindings": "node scripts/testing/next-bindings.mjs",
        "test:next-drift": "node scripts/testing/next-drift.mjs",
        "test:next-core-navigation": (
            "node scripts/testing/next-core-navigation.mjs"
        ),
        "test:next-components": "node scripts/testing/next-components.mjs",
        "test:showcase-ui": "node scripts/testing/showcase-ui.mjs",
        "test:dnd-kit": "node scripts/testing/dnd-kit.mjs",
        "test:recharts": "node scripts/testing/recharts.mjs",
        "integrations:check": (
            "node scripts/integrations/package-integrations.mjs"
        ),
        "test:integrations": "node scripts/testing/package-integrations.mjs",
        "test:next-server": "node scripts/testing/next-server.mjs",
        "test:codecs": "node scripts/testing/codecs.mjs",
        "test:harness": "node scripts/testing/test-lanes.mjs harness",
        "test:prepush": (
            "npm run test:plan && npm run test:support-matrix && "
            "npm run test:architecture && npm run test:security-tooling && "
            "npm run test:haxe && npm run test:adapter-plan && "
            "npm run test:routes && npm run test:snapshots && "
            "npm run test:package-shape && npm run test:compiler-gaps"
        ),
        "fixture:next:compile": "haxe tests/fixtures/next-stable/build.hxml",
        "fixture:next:typegen": "next typegen tests/fixtures/next-stable",
        "fixture:next:typecheck": (
            "tsc6 --project tests/fixtures/next-stable/tsconfig.json --noEmit"
        ),
        "fixture:next:build": "next build tests/fixtures/next-stable",
        "fixture:next:clean": "node scripts/fixtures/next-stable.mjs clean",
        "test:fixture:next-stable": (
            "npm run test:fixture:next-stable:turbopack"
        ),
        "test:fixture:next-stable:turbopack": (
            "node scripts/fixtures/next-stable.mjs verify --turbopack"
        ),
        "test:fixture:next-stable:webpack": (
            "node scripts/fixtures/next-stable.mjs verify --webpack"
        ),
        "test:fixture:next-stable:smoke": (
            "node scripts/fixtures/next-stable.mjs smoke"
        ),
        "test:fixture:next-stable:primary": (
            "npm run test:fixture:next-stable:turbopack && "
            "npm run test:fixture:next-stable:smoke"
        ),
        "test:fixture:next-stable:matrix": (
            "npm run test:fixture:next-stable:turbopack && "
            "npm run test:fixture:next-stable:smoke && "
            "npm run test:fixture:next-stable:webpack && "
            "npm run test:fixture:next-stable:smoke"
        ),
        "test:showcase:landing": (
            "node scripts/examples/showcases.mjs verify landing"
        ),
        "test:showcase:blog": "node scripts/examples/showcases.mjs verify blog",
        "test:showcase:commerce": (
            "node scripts/examples/showcases.mjs verify commerce"
        ),
        "test:showcase:field-atlas": (
            "node scripts/examples/showcases.mjs verify field-atlas"
        ),
        "test:fixture": (
            "npm run test:fixture:next-stable && "
            "npm run test:fixture:next-stable:smoke"
        ),
        "test": (
            "npm run test:plan && npm run test:support-matrix && "
            "npm run test:architecture && npm run test:security-tooling && "
            "npm run test:harness && "
            "npm run test:example:mixed-adoption && npm run test:fixture && "
            "npm run test:example:todoapp && npm run test:showcases"
        ),
        "public:preflight": PUBLIC_PREFLIGHT_COMMAND,
    }
    for name, command in expected_scripts.items():
        if scripts.get(name) != command:
            raise SecurityToolingFailure(f"package.json lost {name}: {command}")
    if package.get("engines") != {"node": ">=20.9.0"}:
        raise SecurityToolingFailure("package.json must retain the Next.js Node floor")
    if package.get("workspaces") != EXPECTED_WORKSPACES:
        raise SecurityToolingFailure(
            "package.json must retain the reviewed CLI and showcase workspaces"
        )
    expected_dev_dependencies = {
        "@dnd-kit/helpers": EXPECTED_DND_KIT_HELPERS_VERSION,
        "@dnd-kit/react": EXPECTED_DND_KIT_REACT_VERSION,
        "@playwright/test": EXPECTED_PLAYWRIGHT_VERSION,
        "@types/node": EXPECTED_NODE_TYPES_VERSION,
        "@types/react": EXPECTED_REACT_TYPES_VERSION,
        "@types/react-dom": EXPECTED_REACT_DOM_TYPES_VERSION,
        "@typescript-eslint/parser": EXPECTED_TYPESCRIPT_ESLINT_PARSER_VERSION,
        "ajv": EXPECTED_AJV_VERSION,
        "eslint": EXPECTED_ESLINT_VERSION,
        "eslint-plugin-react-hooks": EXPECTED_REACT_HOOKS_ESLINT_VERSION,
        "lix": EXPECTED_LIX_VERSION,
        "next": EXPECTED_NEXT_VERSION,
        "nuqs": EXPECTED_NUQS_VERSION,
        "playwright-core": EXPECTED_PLAYWRIGHT_VERSION,
        "react": EXPECTED_REACT_VERSION,
        "react-dom": EXPECTED_REACT_VERSION,
        "react-is": EXPECTED_REACT_VERSION,
        "recharts": EXPECTED_RECHARTS_VERSION,
        "typescript": EXPECTED_TYPESCRIPT_SPEC,
    }
    if package.get("devDependencies") != expected_dev_dependencies:
        raise SecurityToolingFailure(
            "package.json must pin the reviewed toolchain and fixture dependencies"
        )
    expected_overrides = {
        "@reduxjs/toolkit": EXPECTED_REDUX_TOOLKIT_VERSION,
        "@typescript/old": f"npm:typescript@{EXPECTED_TYPESCRIPT_VERSION}",
        "brace-expansion": EXPECTED_BRACE_EXPANSION_VERSION,
        "postcss": EXPECTED_POSTCSS_VERSION,
        "sharp": EXPECTED_SHARP_VERSION,
    }
    if package.get("overrides") != expected_overrides:
        raise SecurityToolingFailure(
            "package.json must retain the reviewed dependency security overrides"
        )

    fixture_package = read_json(NEXT_FIXTURE_PACKAGE)
    if (
        fixture_package.get("private") is not True
        or fixture_package.get("packageManager") != "npm@10.8.2"
        or fixture_package.get("scripts") != {"build": "nextjshx build"}
        or fixture_package.get("dependencies")
        != {
            "next": EXPECTED_NEXT_VERSION,
            "react": EXPECTED_REACT_VERSION,
            "react-dom": EXPECTED_REACT_VERSION,
        }
        or fixture_package.get("devDependencies")
        != {"typescript": EXPECTED_TYPESCRIPT_VERSION}
    ):
        raise SecurityToolingFailure(
            "stable fixture lost its exact clean-consumer build contract"
        )

    fixture_config = read_json(NEXT_FIXTURE_CONFIG)
    fixture_haxe = fixture_config.get("haxe")
    if (
        fixture_config.get("schemaVersion") != 1
        or fixture_config.get("appRoot") != "app"
        or not isinstance(fixture_haxe, dict)
        or fixture_haxe.get("hxml") != "nextjshx.hxml"
        or fixture_haxe.get("generatedRoot") != "src-gen"
        or fixture_haxe.get("defines")
        != [
            "genes.ts",
            "genes.ts.no_extension",
            "genes.ts.jsx_import_source=react",
        ]
        or fixture_config.get("next")
        != {"package": "next", "typedRoutes": True}
        or fixture_config.get("output")
        != {"manifest": ".nextjshx/manifest.json", "format": "project"}
    ):
        raise SecurityToolingFailure(
            "stable fixture lost its closed NextJsHx production-build config"
        )
    fixture_hxml = read_text(NEXT_FIXTURE_HXML)
    for fragment in (
        "-cp ../../../src",
        "-js src-gen/index.tsx",
        "--macro next_stable.AdapterPlan.install()",
        "--macro include('route_handler_fixture')",
        "--macro include('request_proxy_fixture')",
        "--macro include('special_file_fixture')",
        "-dce full",
    ):
        if fragment not in fixture_hxml:
            raise SecurityToolingFailure(
                f"stable fixture Haxe build lost required input: {fragment}"
            )

    todo_package = read_json(TODO_APP_PACKAGE)
    if (
        todo_package.get("name") != "nextjshx-todoapp-example"
        or todo_package.get("private") is not True
        or todo_package.get("packageManager") != "npm@10.8.2"
        or todo_package.get("scripts")
        != {
            "styles": "tailwindcss -i styles/app.css -o public/styles.css --minify",
            "dev": "node ../../scripts/examples/dev-with-styles.mjs",
            "build": "npm run styles && nextjshx build",
            "start": "next start",
        }
        or "exports" in todo_package
        or todo_package.get("dependencies")
        != {
            "@dnd-kit/helpers": EXPECTED_DND_KIT_HELPERS_VERSION,
            "@dnd-kit/react": EXPECTED_DND_KIT_REACT_VERSION,
            "@nextjshx/showcase-ui": "0.0.0",
            "next": EXPECTED_NEXT_VERSION,
            "nuqs": EXPECTED_NUQS_VERSION,
            "react": EXPECTED_REACT_VERSION,
            "react-dom": EXPECTED_REACT_VERSION,
            "react-is": EXPECTED_REACT_VERSION,
            "recharts": EXPECTED_RECHARTS_VERSION,
        }
        or todo_package.get("devDependencies")
        != {
            "@tailwindcss/cli": "4.3.3",
            "tailwindcss": "4.3.3",
            "typescript": EXPECTED_TYPESCRIPT_VERSION,
        }
        or todo_package.get("overrides")
        != {"@reduxjs/toolkit": EXPECTED_REDUX_TOOLKIT_VERSION}
    ):
        raise SecurityToolingFailure(
            "todo app lost its private exact-package production contract"
        )

    todo_config = read_json(TODO_APP_CONFIG)
    todo_haxe = todo_config.get("haxe")
    if (
        todo_config.get("schemaVersion") != 1
        or todo_config.get("appRoot") != "app"
        or not isinstance(todo_haxe, dict)
        or todo_haxe.get("hxml") != "nextjshx.hxml"
        or todo_haxe.get("generatedRoot") != "src-gen"
        or todo_haxe.get("defines")
        != [
            "genes.ts",
            "genes.ts.no_extension",
            "genes.ts.jsx_import_source=react",
        ]
        or todo_config.get("next")
        != {
            "package": "next",
            "typedRoutes": True,
            "cacheComponents": True,
        }
        or todo_config.get("output")
        != {"manifest": ".nextjshx/manifest.json", "format": "project"}
    ):
        raise SecurityToolingFailure(
            "todo app lost its closed NextJsHx production-build config"
        )
    if read_text(TODO_APP_NEXT_CONFIG) != (
        "/** @type {import('next').NextConfig} */\n"
        "const nextConfig = {\n"
        "  cacheComponents: true,\n"
        "  typedRoutes: true,\n"
        "};\n\n"
        "export default nextConfig;\n"
    ):
        raise SecurityToolingFailure(
            "todo app lost its exact native Cache Components config"
        )
    todo_hxml = read_text(TODO_APP_HXML)
    for fragment in (
        "-cp ../showcase-ui/haxe",
        "-cp ../../src",
        "-js src-gen/index.tsx",
        "--macro todoapp.AdapterPlan.install()",
        "--macro include('todoapp.app')",
        "--macro include('todoapp.actions')",
        "--macro include('todoapp.client')",
        "--macro include('todoapp.cache')",
        "--macro include('todoapp.routes')",
        "-dce full",
    ):
        if fragment not in todo_hxml:
            raise SecurityToolingFailure(
                f"todo app Haxe build lost required input: {fragment}"
            )

    seed_lines = read_text(TODO_APP_SEED).splitlines()
    if (
        not seed_lines
        or seed_lines[0] != "id\tcompleted\tpriority\ttitle\tnote"
        or len(seed_lines) != 4
        or [line.split("\t", 1)[0] for line in seed_lines[1:]]
        != [
            "shape-first-release",
            "prove-production-build",
            "write-adoption-guide",
        ]
        or any(len(line.split("\t")) != 5 for line in seed_lines[1:])
    ):
        raise SecurityToolingFailure(
            "todo app deterministic fixed-schema seed drifted"
        )

    showcase_ui_package = read_json(SHOWCASE_UI_PACKAGE)
    if (
        showcase_ui_package.get("name") != "@nextjshx/showcase-ui"
        or showcase_ui_package.get("version") != "0.0.0"
        or showcase_ui_package.get("private") is not True
        or showcase_ui_package.get("packageManager") != "npm@10.8.2"
        or showcase_ui_package.get("type") != "module"
        or showcase_ui_package.get("sideEffects") != ["./src/styles/theme.css"]
        or showcase_ui_package.get("scripts")
        != {"typecheck": "tsc6 --project tsconfig.json --noEmit"}
        or showcase_ui_package.get("exports")
        != {
            "./badge": "./src/components/ui/badge.tsx",
            "./button": "./src/components/ui/button.tsx",
            "./card": "./src/components/ui/card.tsx",
            "./command": "./src/components/ui/command.tsx",
            "./icons": "./src/icons.ts",
            "./input": "./src/components/ui/input.tsx",
            "./separator": "./src/components/ui/separator.tsx",
            "./sheet": "./src/components/ui/sheet.tsx",
            "./textarea": "./src/components/ui/textarea.tsx",
            "./theme.css": "./src/styles/theme.css",
        }
        or showcase_ui_package.get("dependencies")
        != {
            "@radix-ui/react-dialog": "1.1.19",
            "@radix-ui/react-separator": "1.1.11",
            "@radix-ui/react-slot": "1.3.0",
            "class-variance-authority": "0.7.1",
            "clsx": "2.1.1",
            "cmdk": "1.1.1",
            "lucide-react": "1.25.0",
            "tailwind-merge": "3.6.0",
            "tw-animate-css": "1.4.0",
        }
        or showcase_ui_package.get("peerDependencies")
        != {
            "react": EXPECTED_REACT_VERSION,
            "react-dom": EXPECTED_REACT_VERSION,
        }
        or showcase_ui_package.get("devDependencies")
        != {
            "@types/react": EXPECTED_REACT_TYPES_VERSION,
            "@types/react-dom": EXPECTED_REACT_DOM_TYPES_VERSION,
            "typescript": EXPECTED_TYPESCRIPT_SPEC,
        }
    ):
        raise SecurityToolingFailure(
            "shared showcase UI lost its private exact-package source contract"
        )

    showcase_names = {
        "showcase-landing": "@nextjshx/showcase-landing",
        "showcase-blog": "@nextjshx/showcase-blog",
        "showcase-commerce": "@nextjshx/showcase-commerce",
    }
    showcase_exports = {
        "showcase-landing": None,
        "showcase-blog": None,
        "showcase-commerce": None,
    }
    for showcase_root in SHOWCASE_APP_ROOTS:
        showcase_package = read_json(showcase_root / "package.json")
        expected_exports = showcase_exports[showcase_root.name]
        if (
            showcase_package.get("name") != showcase_names[showcase_root.name]
            or showcase_package.get("version") != "0.0.0"
            or showcase_package.get("private") is not True
            or showcase_package.get("packageManager") != "npm@10.8.2"
            or showcase_package.get("scripts")
            != {
                "styles": (
                    "tailwindcss -i styles/app.css -o public/styles.css --minify"
                ),
                "dev": "node ../../scripts/examples/dev-with-styles.mjs",
                "build": "npm run styles && nextjshx build",
                "start": "next start",
            }
            or showcase_package.get("dependencies")
            != {
                "@nextjshx/showcase-ui": "0.0.0",
                "next": EXPECTED_NEXT_VERSION,
                "react": EXPECTED_REACT_VERSION,
                "react-dom": EXPECTED_REACT_VERSION,
            }
            or showcase_package.get("devDependencies")
            != {
                "@tailwindcss/cli": "4.3.3",
                "tailwindcss": "4.3.3",
                "typescript": EXPECTED_TYPESCRIPT_VERSION,
            }
            or (
                expected_exports is None
                and "exports" in showcase_package
            )
            or (
                expected_exports is not None
                and showcase_package.get("exports") != expected_exports
            )
        ):
            raise SecurityToolingFailure(
                f"{showcase_root.name} lost its private exact-package contract"
            )

        showcase_config = read_json(showcase_root / "nextjshx.config.json")
        showcase_haxe = showcase_config.get("haxe")
        if (
            showcase_config.get("schemaVersion") != 1
            or showcase_config.get("appRoot") != "app"
            or not isinstance(showcase_haxe, dict)
            or showcase_haxe.get("hxml") != "nextjshx.hxml"
            or showcase_haxe.get("generatedRoot") != "src-gen"
            or showcase_haxe.get("defines")
            != [
                "genes.ts",
                "genes.ts.no_extension",
                "genes.ts.jsx_import_source=react",
            ]
            or showcase_config.get("next")
            != {"package": "next", "typedRoutes": True}
            or showcase_config.get("output")
            != {"manifest": ".nextjshx/manifest.json", "format": "project"}
        ):
            raise SecurityToolingFailure(
                f"{showcase_root.name} lost its closed NextJsHx build config"
            )

        showcase_hxml = read_text(showcase_root / "nextjshx.hxml")
        for fragment in (
            "-lib genes-ts",
            "-cp ../showcase-ui/haxe",
            "-cp ../../src",
            "-js src-gen/index.tsx",
            "-dce full",
        ):
            if fragment not in showcase_hxml:
                raise SecurityToolingFailure(
                    f"{showcase_root.name} Haxe build lost required input: {fragment}"
                )

    mixed_package = read_json(MIXED_ADOPTION_ROOT / "package.json")
    if (
        mixed_package.get("name") != "@nextjshx/mixed-adoption"
        or mixed_package.get("version") != "0.0.0"
        or mixed_package.get("private") is not True
        or mixed_package.get("packageManager") != "npm@10.8.2"
        or mixed_package.get("exports")
        != {
            "./native-component": "./native/signal-card.tsx",
            "./native-hook": "./native/use-signal.ts",
            "./native-module": "./native/signal-format.ts",
        }
        or mixed_package.get("scripts")
        != {
            "styles": (
                "tailwindcss -i styles/app.css -o public/styles.css --minify"
            ),
            "dev": "node ../../scripts/examples/dev-with-styles.mjs",
            "generate": "nextjshx generate",
            "typecheck": "nextjshx typecheck",
            "build": "npm run styles && nextjshx build",
            "start": "next start",
        }
        or mixed_package.get("dependencies")
        != {
            "@nextjshx/showcase-ui": "0.0.0",
            "next": EXPECTED_NEXT_VERSION,
            "react": EXPECTED_REACT_VERSION,
            "react-dom": EXPECTED_REACT_VERSION,
        }
        or mixed_package.get("devDependencies")
        != {
            "@tailwindcss/cli": "4.3.3",
            "tailwindcss": "4.3.3",
            "typescript": EXPECTED_TYPESCRIPT_VERSION,
        }
    ):
        raise SecurityToolingFailure(
            "mixed-adoption example lost its exact native/Haxe package contract"
        )
    mixed_config = read_json(MIXED_ADOPTION_ROOT / "nextjshx.config.json")
    if (
        mixed_config.get("appRoot") != "app"
        or mixed_config.get("next")
        != {"package": "next", "typedRoutes": True}
        or mixed_config.get("output")
        != {"manifest": ".nextjshx/manifest.json", "format": "project"}
    ):
        raise SecurityToolingFailure(
            "mixed-adoption example lost its closed NextJsHx config"
        )
    mixed_hxml = read_text(MIXED_ADOPTION_ROOT / "nextjshx.hxml")
    for fragment in (
        "-lib genes-ts",
        "-cp ../showcase-ui/haxe",
        "-cp ../../src",
        "-js src-gen/index.tsx",
        "--macro mixed_adoption.AdapterPlan.install()",
        "-dce full",
    ):
        if fragment not in mixed_hxml:
            raise SecurityToolingFailure(
                f"mixed-adoption Haxe build lost required input: {fragment}"
            )

    package_lock = read_json(PACKAGE_LOCK)
    packages = package_lock.get("packages")
    if not isinstance(packages, dict):
        raise SecurityToolingFailure("package-lock.json has no packages map")
    root_lock = packages.get("")
    if (
        not isinstance(root_lock, dict)
        or root_lock.get("license") != EXPECTED_LICENSE
        or root_lock.get("devDependencies") != expected_dev_dependencies
        or root_lock.get("workspaces") != EXPECTED_WORKSPACES
    ):
        raise SecurityToolingFailure("package-lock root drifted from reviewed pins")
    mixed_lock = packages.get("examples/mixed-adoption")
    mixed_link = packages.get("node_modules/@nextjshx/mixed-adoption")
    if (
        not isinstance(mixed_lock, dict)
        or mixed_lock.get("name") != "@nextjshx/mixed-adoption"
        or mixed_lock.get("version") != "0.0.0"
        or mixed_link
        != {"resolved": "examples/mixed-adoption", "link": True}
    ):
        raise SecurityToolingFailure(
            "package-lock lost the reviewed mixed-adoption workspace identity"
        )

    cli_package = read_json(CLI_PACKAGE)
    expected_cli_scripts = {
        "build": "npm run build:test",
        "build:runtime": "node scripts/ensure-build.mjs runtime",
        "build:test": "node scripts/ensure-build.mjs test",
        "cli": "npm run build:runtime && node .tmp/src/cli.js",
        "test:commands": (
            "npm run build:test && node --test "
            ".tmp/test/adapter-plan-renderer.test.js "
            ".tmp/test/boundary-plan.test.js "
            ".tmp/test/cli-entrypoint.test.js .tmp/test/commands.test.js "
            ".tmp/test/dev-generated-tree.test.js "
            ".tmp/test/dev-loop.test.js .tmp/test/dev-process.test.js "
            ".tmp/test/dev.test.js .tmp/test/init.test.js "
            ".tmp/test/next-client-artifacts.test.js "
            ".tmp/test/profile.test.js "
            ".tmp/test/watch-inputs.test.js"
        ),
        "test:config": (
            "npm run build:test && node --test .tmp/test/config-discovery.test.js"
        ),
        "test:ownership": (
            "npm run build:test && node --test .tmp/test/ownership-preflight.test.js"
        ),
        "test:publication": (
            "npm run build:test && node --test .tmp/test/publication.test.js"
        ),
        "test": "npm run build:test && node --test .tmp/test/*.test.js",
    }
    expected_cli_dependencies = {
        "ajv": EXPECTED_AJV_VERSION,
        "typescript": EXPECTED_TYPESCRIPT_SPEC,
    }
    if (
        cli_package.get("name") != "@nextjshx/cli-internal"
        or cli_package.get("private") is not True
        or cli_package.get("type") != "module"
        or cli_package.get("bin") != {"nextjshx": "./bin/nextjshx.js"}
        or cli_package.get("scripts") != expected_cli_scripts
        or cli_package.get("devDependencies") != expected_cli_dependencies
        or cli_package.get("engines") != {"node": ">=20.9.0"}
    ):
        raise SecurityToolingFailure("internal CLI workspace contract drifted")
    cli_lock = packages.get("tools/cli")
    if (
        not isinstance(cli_lock, dict)
        or cli_lock.get("name") != "@nextjshx/cli-internal"
        or cli_lock.get("bin") != {"nextjshx": "bin/nextjshx.js"}
        or cli_lock.get("devDependencies") != expected_cli_dependencies
    ):
        raise SecurityToolingFailure("package-lock lost the internal CLI workspace")
    cli_link = packages.get("node_modules/@nextjshx/cli-internal")
    if (
        not isinstance(cli_link, dict)
        or cli_link.get("resolved") != "tools/cli"
        or cli_link.get("link") is not True
    ):
        raise SecurityToolingFailure("package-lock lost the internal CLI workspace link")

    cli_tsconfig = read_json(CLI_TSCONFIG)
    cli_options = cli_tsconfig.get("compilerOptions")
    if not isinstance(cli_options, dict) or any(
        cli_options.get(option) is not True
        for option in (
            "exactOptionalPropertyTypes",
            "noEmitOnError",
            "noUncheckedIndexedAccess",
            "strict",
        )
    ):
        raise SecurityToolingFailure("CLI TypeScript must retain strict fail-closed checks")
    cli_runtime_tsconfig = read_json(CLI_RUNTIME_TSCONFIG)
    if (
        cli_runtime_tsconfig.get("extends") != "./tsconfig.json"
        or cli_runtime_tsconfig.get("include") != ["src/**/*.ts"]
        or cli_runtime_tsconfig.get("exclude") != ["test/**/*.ts"]
    ):
        raise SecurityToolingFailure(
            "runtime CLI build must inherit strict checks while excluding the test corpus"
        )
    cli_build_helper = read_text(ROOT / "tools/cli/scripts/ensure-build.mjs")
    for fragment in (
        "createHash",
        "package-lock.json",
        "tsconfig.runtime.json",
        "typescript/package.json",
        ".nextjshx-cli-build.json",
        "runtimeOutputFingerprint",
        "testOutputFingerprint",
        "renameSync",
    ):
        if fragment not in cli_build_helper:
            raise SecurityToolingFailure(
                f"prepared CLI build lost stale-output protection: {fragment}"
            )

    config_schema = read_json(CONFIG_SCHEMA)
    if (
        config_schema.get("$id")
        != "https://nextjshx.dev/schemas/config-v2.json"
        or config_schema.get("additionalProperties") is not False
        or config_schema.get("properties", {})
        .get("schemaVersion", {})
        .get("const")
        != 2
    ):
        raise SecurityToolingFailure("NextJsHx config schema-v2 contract drifted")
    output_manifest_schema = read_json(OUTPUT_MANIFEST_SCHEMA)
    if (
        output_manifest_schema.get("$id")
        != "https://nextjshx.dev/schemas/generated-output-manifest-v2.json"
        or output_manifest_schema.get("additionalProperties") is not False
        or output_manifest_schema.get("properties", {})
        .get("protocol", {})
        .get("const")
        != "nextjshx.generated-output"
        or output_manifest_schema.get("properties", {})
        .get("version", {})
        .get("const")
        != 2
    ):
        raise SecurityToolingFailure("generated-output manifest schema-v2 drifted")
    output_transaction_schema = read_json(OUTPUT_TRANSACTION_SCHEMA)
    if (
        output_transaction_schema.get("$id")
        != "https://nextjshx.dev/schemas/generated-output-transaction-v1.json"
        or output_transaction_schema.get("additionalProperties") is not False
        or output_transaction_schema.get("properties", {})
        .get("protocol", {})
        .get("const")
        != "nextjshx.generated-output-transaction"
        or output_transaction_schema.get("properties", {})
        .get("version", {})
        .get("const")
        != 1
    ):
        raise SecurityToolingFailure("generated-output transaction schema-v1 drifted")

    entrypoints_schema = read_json(NEXT_ENTRYPOINTS_SCHEMA)
    surface_schema = read_json(NEXT_SURFACE_SCHEMA)
    surface_fixtures_schema = read_json(NEXT_SURFACE_FIXTURES_SCHEMA)
    binding_overrides_schema = read_json(NEXT_BINDING_OVERRIDES_SCHEMA)
    binding_implementations_schema = read_json(NEXT_BINDING_IMPLEMENTATIONS_SCHEMA)
    binding_ir_schema = read_json(NEXT_BINDING_IR_SCHEMA)
    drift_schema = read_json(NEXT_DRIFT_SCHEMA)
    surface_entrypoint_schema = surface_schema.get("$defs", {}).get(
        "publicEntrypoint", {}
    )
    if (
        entrypoints_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-public-entrypoints-v1.json"
        or entrypoints_schema.get("additionalProperties") is not False
        or entrypoints_schema.get("properties", {})
        .get("schemaVersion", {})
        .get("const")
        != 1
    ):
        raise SecurityToolingFailure("Next public-entrypoint schema-v1 drifted")
    if (
        surface_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-public-surface-v1.json"
        or surface_schema.get("additionalProperties") is not False
        or surface_schema.get("properties", {}).get("protocol", {}).get("const")
        != "nextjshx.next-public-surface"
        or surface_schema.get("properties", {}).get("version", {}).get("const")
        != 1
        or surface_schema.get("$defs", {}).get("semver", {}).get("pattern")
        != EXPECTED_PACKAGE_VERSION_PATTERN
        or "entrypointDeclaration"
        in surface_entrypoint_schema.get("required", [])
        or surface_entrypoint_schema.get("properties", {})
        .get("exports", {})
        .get("minItems")
        is not None
        or surface_schema.get("properties", {})
        .get("internalSupportingDeclarations", {})
        .get("minItems")
        != 0
    ):
        raise SecurityToolingFailure("Next normalized-surface schema-v1 drifted")
    if (
        surface_fixtures_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-surface-fixtures-v1.json"
        or surface_fixtures_schema.get("additionalProperties") is not False
    ):
        raise SecurityToolingFailure("Next surface-fixture schema-v1 drifted")
    if (
        binding_overrides_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-binding-overrides-v1.json"
        or binding_overrides_schema.get("additionalProperties") is not False
        or binding_overrides_schema.get("properties", {})
        .get("safetyOverrides", {})
        .get("maxItems")
        != 8
    ):
        raise SecurityToolingFailure("Next binding-override schema-v1 drifted")
    if (
        binding_implementations_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-binding-implementations-v1.json"
        or binding_implementations_schema.get("additionalProperties") is not False
        or binding_implementations_schema.get("properties", {})
        .get("schemaVersion", {})
        .get("const")
        != 1
    ):
        raise SecurityToolingFailure(
            "Next binding-implementation schema-v1 drifted"
        )
    if (
        binding_ir_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-binding-ir-v1.json"
        or binding_ir_schema.get("additionalProperties") is not False
        or binding_ir_schema.get("properties", {}).get("protocol", {}).get("const")
        != "nextjshx.next-binding-ir"
        or binding_ir_schema.get("$defs", {}).get("semver", {}).get("pattern")
        != EXPECTED_PACKAGE_VERSION_PATTERN
    ):
        raise SecurityToolingFailure("Next binding-IR schema-v1 drifted")
    if (
        drift_schema.get("$id")
        != "https://nextjshx.dev/schemas/next-surface-drift-v1.json"
        or drift_schema.get("additionalProperties") is not False
        or drift_schema.get("properties", {}).get("protocol", {}).get("const")
        != "nextjshx.next-surface-drift"
        or drift_schema.get("$defs", {}).get("semver", {}).get("pattern")
        != EXPECTED_PACKAGE_VERSION_PATTERN
    ):
        raise SecurityToolingFailure("Next drift-report schema-v1 drifted")

    entrypoints = read_json(NEXT_ENTRYPOINTS)
    entrypoint_packages = entrypoints.get("packages")
    allowlisted = entrypoints.get("entrypoints")
    if (
        entrypoints.get("$schema")
        != "../schemas/next-public-entrypoints.schema.json"
        or entrypoints.get("schemaVersion") != 1
        or entrypoint_packages
        != {
            "next": {"name": "next", "version": EXPECTED_NEXT_VERSION},
            "typescript": {
                "importName": "typescript",
                "name": "@typescript/typescript6",
                "version": EXPECTED_TYPESCRIPT_VERSION,
            },
        }
        or not isinstance(allowlisted, list)
        or len(allowlisted) != 17
    ):
        raise SecurityToolingFailure("Next public-entrypoint allowlist baseline drifted")
    signature_hashes = [
        export.get("signatureHash")
        for entrypoint in allowlisted
        if isinstance(entrypoint, dict)
        for export in entrypoint.get("exports", [])
        if isinstance(export, dict)
    ]
    if len(signature_hashes) != 68 or any(
        not isinstance(value, str)
        or re.fullmatch(r"sha256:[0-9a-f]{64}", value) is None
        or value == "sha256:" + "0" * 64
        for value in signature_hashes
    ):
        raise SecurityToolingFailure("Next allowlist lost reviewed export signatures")

    surface = read_json(NEXT_SURFACE)
    internal_declarations = surface.get("internalSupportingDeclarations")
    if (
        surface.get("protocol") != "nextjshx.next-public-surface"
        or surface.get("version") != 1
        or surface.get("sources", {}).get("packages") != entrypoint_packages
        or not isinstance(surface.get("publicEntrypoints"), list)
        or len(surface["publicEntrypoints"]) != 17
        or not isinstance(internal_declarations, list)
        or len(internal_declarations) == 0
        or re.fullmatch(r"sha256:[0-9a-f]{64}", surface.get("surfaceHash", ""))
        is None
        or any(
            not isinstance(declaration, dict)
            or declaration.get("compatibilityPromise") is not False
            or declaration.get("runtimeImportAllowed") is not False
            or not str(declaration.get("path", "")).startswith("dist/")
            for declaration in internal_declarations
        )
    ):
        raise SecurityToolingFailure("normalized Next public surface baseline drifted")
    surface_fixtures = read_json(NEXT_SURFACE_FIXTURES)
    if (
        surface_fixtures.get("$schema")
        != "../../schemas/next-surface-fixtures.schema.json"
        or surface_fixtures.get("schemaVersion") != 1
        or not isinstance(surface_fixtures.get("fixtures"), list)
        or len(surface_fixtures["fixtures"]) != 10
    ):
        raise SecurityToolingFailure("Next surface fixture catalog drifted")

    binding_overrides = read_json(NEXT_BINDING_OVERRIDES)
    safety_overrides = binding_overrides.get("safetyOverrides")
    generators = binding_overrides.get("generators")
    if (
        binding_overrides.get("$schema")
        != "../schemas/next-binding-overrides.schema.json"
        or binding_overrides.get("schemaVersion") != 1
        or binding_overrides.get("reviewedSurfaceHash") != surface.get("surfaceHash")
        or not isinstance(safety_overrides, list)
        or len(safety_overrides) != 8
        or not isinstance(generators, list)
        or len(generators) != 1
        or generators[0].get("output") != "src/nextjs/raw/ServerRuntime.hx"
        or not isinstance(binding_overrides.get("acceptedTransitions"), list)
    ):
        raise SecurityToolingFailure("reviewed Next binding overrides drifted")
    override_snapshot = read_json(NEXT_OVERRIDE_SNAPSHOT)
    if override_snapshot != {
        "snapshotVersion": 1,
        "reviewedSurfaceHash": binding_overrides.get("reviewedSurfaceHash"),
        "safetyOverrides": safety_overrides,
        "generators": generators,
    }:
        raise SecurityToolingFailure("Next binding override snapshot drifted")

    binding_implementations = read_json(NEXT_BINDING_IMPLEMENTATIONS)
    implementation_groups = binding_implementations.get("implementations")
    if (
        binding_implementations.get("$schema")
        != "../schemas/next-binding-implementations.schema.json"
        or binding_implementations.get("schemaVersion") != 1
        or binding_implementations.get("reviewedSurfaceHash")
        != surface.get("surfaceHash")
        or not isinstance(implementation_groups, list)
        or len(implementation_groups) != 15
        or sum(
            len(group.get("symbols", []))
            for group in implementation_groups
            if isinstance(group, dict)
        )
        != 65
        or sum(
            len(group.get("outputs", []))
            for group in implementation_groups
            if isinstance(group, dict)
        )
        != 55
        or any(
            not isinstance(group, dict)
            or group.get("owningBead")
            not in {"nxhx-f34.3.3", "nxhx-f34.3.4", "nxhx-f34.3.5"}
            or group.get("fixture")
            != {
                "nxhx-f34.3.3": "tests/next-core-navigation",
                "nxhx-f34.3.4": "tests/next-components",
                "nxhx-f34.3.5": "tests/next-server",
            }.get(group.get("owningBead"))
            for group in implementation_groups
        )
    ):
        raise SecurityToolingFailure("reviewed Next binding implementations drifted")

    binding_ir = read_json(NEXT_BINDING_IR)
    binding_exports = binding_ir.get("exports")
    generated_externs = binding_ir.get("generatedExterns")
    curated_externs = binding_ir.get("curatedExterns")
    transition_cursor = binding_overrides.get("bootstrapReview", {}).get(
        "initialIrHash"
    )
    for transition in binding_overrides.get("acceptedTransitions", []):
        if (
            not isinstance(transition, dict)
            or transition.get("fromIrHash") != transition_cursor
        ):
            raise SecurityToolingFailure(
                "Next binding acceptedTransitions must form a contiguous review chain"
            )
        transition_cursor = transition.get("toIrHash")
    if (
        binding_ir.get("protocol") != "nextjshx.next-binding-ir"
        or binding_ir.get("version") != 1
        or binding_ir.get("packages") != entrypoint_packages
        or binding_ir.get("surfaceHash") != surface.get("surfaceHash")
        or binding_ir.get("sources", {}).get("implementations")
        != "config/next-binding-implementations.json"
        or transition_cursor != binding_ir.get("irHash")
        or not isinstance(binding_exports, list)
        or len(binding_exports) != 68
        or sum(
            len(item.get("declarations", []))
            for item in binding_exports
            if isinstance(item, dict)
        )
        != 78
        or not isinstance(generated_externs, list)
        or len(generated_externs) != 1
        or generated_externs[0].get("output")
        != "src/nextjs/raw/ServerRuntime.hx"
        or not isinstance(curated_externs, list)
        or len(curated_externs) != 15
        or sum(
            len(group.get("outputs", []))
            for group in curated_externs
            if isinstance(group, dict)
        )
        != 55
        or {
            status: sum(
                1
                for item in binding_exports
                if isinstance(item, dict)
                and item.get("generation", {}).get("status") == status
            )
            for status in ("pending", "curated", "generated")
        }
        != {"pending": 2, "curated": 65, "generated": 1}
        or re.fullmatch(r"sha256:[0-9a-f]{64}", binding_ir.get("irHash", ""))
        is None
    ):
        raise SecurityToolingFailure("normalized Next binding IR baseline drifted")
    implementation_by_id = {
        group.get("id"): group
        for group in implementation_groups
        if isinstance(group, dict)
    }
    for curated in curated_externs:
        if not isinstance(curated, dict):
            raise SecurityToolingFailure("Next curated extern group is not an object")
        configured = implementation_by_id.get(curated.get("id"))
        if configured is None or {
            "module": curated.get("module"),
            "exports": curated.get("exports"),
            "strategy": curated.get("strategy"),
            "owningBead": curated.get("owningBead"),
            "fixture": curated.get("fixture"),
        } != {
            "module": configured.get("module"),
            "exports": [
                symbol.get("export")
                for symbol in configured.get("symbols", [])
                if isinstance(symbol, dict)
            ],
            "strategy": configured.get("strategy"),
            "owningBead": configured.get("owningBead"),
            "fixture": configured.get("fixture"),
        }:
            raise SecurityToolingFailure(
                "Next curated extern group drifted from its implementation manifest"
            )
        curated_outputs = curated.get("outputs")
        if not isinstance(curated_outputs, list) or [
            output.get("path")
            for output in curated_outputs
            if isinstance(output, dict)
        ] != configured.get("outputs"):
            raise SecurityToolingFailure(
                "Next curated extern output list drifted from its implementation manifest"
            )
        for output in curated_outputs:
            if not isinstance(output, dict):
                raise SecurityToolingFailure("Next curated output is not an object")
            relative = output.get("path")
            if not isinstance(relative, str):
                raise SecurityToolingFailure("Next curated output path is invalid")
            output_path = (ROOT / relative).resolve()
            if ROOT not in output_path.parents or not output_path.is_file():
                raise SecurityToolingFailure(
                    f"Next curated output escapes the repository: {relative}"
                )
            actual = "sha256:" + hashlib.sha256(output_path.read_bytes()).hexdigest()
            if output.get("sha256") != actual:
                raise SecurityToolingFailure(
                    f"Next curated output digest drifted: {relative}"
                )
            source = read_text(output_path)
            code = re.sub(r"/\*[\s\S]*?\*/|//[^\n]*", "", source)
            if re.search(r'@:jsRequire\s*\(\s*["\']next/dist', code):
                raise SecurityToolingFailure(
                    f"Next curated output imports a private runtime path: {relative}"
                )
            if re.search(r"\bDynamic\b", code):
                raise SecurityToolingFailure(
                    f"Next curated output introduced unsafe Haxe Dynamic: {relative}"
                )
    drift = read_json(NEXT_DRIFT)
    counts = drift.get("counts")
    if (
        drift.get("protocol") != "nextjshx.next-surface-drift"
        or drift.get("version") != 1
        or drift.get("baseline", {}).get("irHash") != binding_ir.get("irHash")
        or drift.get("candidate", {}).get("irHash") != binding_ir.get("irHash")
        or counts
        != {
            "compatible": 0,
            "additive": 0,
            "behavioralReviewRequired": 0,
            "breaking": 0,
            "unsupportedConstruct": 0,
        }
        or drift.get("changes") != []
        or drift.get("decision", {}).get("status") != "clean"
    ):
        raise SecurityToolingFailure("checked Next binding drift report is not clean")
    server_runtime = read_text(SERVER_RUNTIME_EXTERN)
    for fragment in (
        "typedef ServerRuntime = Undefinable<ServerRuntimeValue>;",
        'final NodeJs = "nodejs";',
        'final ExperimentalEdge = "experimental-edge";',
        'final Edge = "edge";',
    ):
        if fragment not in server_runtime:
            raise SecurityToolingFailure(
                f"generated ServerRuntime extern lost reviewed content: {fragment}"
            )
    if (
        server_runtime.count("@:ts.type") != 2
        or '\\"nodejs\\" | \\"experimental-edge\\" | \\"edge\\" | undefined'
        not in server_runtime
    ):
        raise SecurityToolingFailure(
            "generated ServerRuntime must preserve exact Haxe and TypeScript unions"
        )

    expected_lock_versions = {
        "node_modules/@dnd-kit/helpers": EXPECTED_DND_KIT_HELPERS_VERSION,
        "node_modules/@dnd-kit/react": EXPECTED_DND_KIT_REACT_VERSION,
        "node_modules/@playwright/test": EXPECTED_PLAYWRIGHT_VERSION,
        "node_modules/@types/node": EXPECTED_NODE_TYPES_VERSION,
        "node_modules/@types/react": EXPECTED_REACT_TYPES_VERSION,
        "node_modules/@types/react-dom": EXPECTED_REACT_DOM_TYPES_VERSION,
        "node_modules/@typescript-eslint/parser": (
            EXPECTED_TYPESCRIPT_ESLINT_PARSER_VERSION
        ),
        "node_modules/ajv": EXPECTED_AJV_VERSION,
        "node_modules/brace-expansion": EXPECTED_BRACE_EXPANSION_VERSION,
        "node_modules/eslint": EXPECTED_ESLINT_VERSION,
        "node_modules/eslint-plugin-react-hooks": (
            EXPECTED_REACT_HOOKS_ESLINT_VERSION
        ),
        "node_modules/lix": EXPECTED_LIX_VERSION,
        "node_modules/next": EXPECTED_NEXT_VERSION,
        "node_modules/nuqs": EXPECTED_NUQS_VERSION,
        "node_modules/playwright-core": EXPECTED_PLAYWRIGHT_VERSION,
        "node_modules/playwright": EXPECTED_PLAYWRIGHT_VERSION,
        "node_modules/postcss": EXPECTED_POSTCSS_VERSION,
        "node_modules/sharp": EXPECTED_SHARP_VERSION,
        "node_modules/react": EXPECTED_REACT_VERSION,
        "node_modules/react-dom": EXPECTED_REACT_VERSION,
        "node_modules/react-is": EXPECTED_REACT_VERSION,
        "node_modules/recharts": EXPECTED_RECHARTS_VERSION,
        "node_modules/recharts/node_modules/@reduxjs/toolkit": (
            EXPECTED_REDUX_TOOLKIT_VERSION
        ),
        "node_modules/immer": EXPECTED_IMMER_VERSION,
        "node_modules/typescript": EXPECTED_TYPESCRIPT_VERSION,
        "node_modules/typescript/node_modules/@typescript/old": (
            EXPECTED_TYPESCRIPT_VERSION
        ),
    }
    for path, version in expected_lock_versions.items():
        entry = packages.get(path)
        if not isinstance(entry, dict) or entry.get("version") != version:
            raise SecurityToolingFailure(
                f"package-lock did not resolve {path} to exact version {version}"
            )

    typescript_lock = packages.get("node_modules/typescript")
    if (
        not isinstance(typescript_lock, dict)
        or typescript_lock.get("name") != "@typescript/typescript6"
    ):
        raise SecurityToolingFailure("package-lock lost the TypeScript 6 wrapper alias")

    haxerc = read_json(HAXERC)
    if haxerc != {"version": EXPECTED_HAXE_VERSION, "resolveLibs": "scoped"}:
        raise SecurityToolingFailure("the Haxe toolchain contract drifted")


def validate_haxe_locks() -> None:
    genes = read_text(GENES_LOCK)
    genes_fragments = (
        (
            'lix --silent download "gh://github.com/fullofcaffeine/genes-ts#'
            f'{EXPECTED_GENES_COMMIT}"'
        ),
        f"genes-ts/{EXPECTED_GENES_VERSION}/github/{EXPECTED_GENES_COMMIT}",
        f"-D genes-ts={EXPECTED_GENES_VERSION}",
        "-lib helder.set",
        "--macro genes.Generator.use()",
        "--macro genes.react.InlineMarkup.enable()",
    )
    for fragment in genes_fragments:
        if fragment not in genes:
            raise SecurityToolingFailure(
                f"genes-ts Lix lock lost reviewed content: {fragment}"
            )
    if re.search(r"(?m)^-cp (?!\$\{HAXE_LIBCACHE\}/)", genes):
        raise SecurityToolingFailure("genes-ts Lix lock contains a non-cache classpath")

    helder = read_text(HELDER_LOCK)
    helder_fragments = (
        f'lix --silent download "haxelib:/helder.set#{EXPECTED_HELDER_VERSION}"',
        f"helder.set/{EXPECTED_HELDER_VERSION}/haxelib/src",
        f"-D helder.set={EXPECTED_HELDER_VERSION}",
    )
    for fragment in helder_fragments:
        if fragment not in helder:
            raise SecurityToolingFailure(
                f"helder.set Lix lock lost reviewed content: {fragment}"
            )
    if re.search(r"(?m)^-cp (?!\$\{HAXE_LIBCACHE\}/)", helder):
        raise SecurityToolingFailure("helder.set Lix lock contains a non-cache classpath")


def validate_test_lane_topology() -> None:
    schema = read_json(TEST_LANES_SCHEMA)
    if schema.get("$id") != "https://nextjshx.dev/schemas/test-lanes.schema.json":
        raise SecurityToolingFailure("test-lane schema identity drifted")

    manifest = read_json(TEST_LANES)
    if manifest.get("schemaVersion") != 2:
        raise SecurityToolingFailure("test-lane manifest must use scorecard schema v2")
    if manifest.get("selectionMode") != "observation":
        raise SecurityToolingFailure(
            "affected test selection must remain observational until its confidence gate passes"
        )
    if manifest.get("fullBackstops") != {
        "main": True,
        "nightly": True,
        "release": True,
    }:
        raise SecurityToolingFailure(
            "test-lane topology must retain main, nightly, and release full backstops"
        )
    confidence = manifest.get("confidenceWindow")
    if (
        not isinstance(confidence, dict)
        or confidence.get("minimumRuns", 0) < 30
        or confidence.get("minimumDays", 0) < 14
        or confidence.get("resetOnMiss") is not True
    ):
        raise SecurityToolingFailure("selector promotion confidence policy weakened")

    lanes = manifest.get("lanes")
    if not isinstance(lanes, list):
        raise SecurityToolingFailure("test-lane manifest must contain lanes")
    lane_by_id = {
        lane.get("id"): lane for lane in lanes if isinstance(lane, dict)
    }
    if len(lane_by_id) != len(lanes):
        raise SecurityToolingFailure("test-lane manifest has invalid or duplicate IDs")

    required_ids = {
        "loop.validate",
        "loop.self",
        "cli.preparation",
        "haxe.positive",
        "haxe.negative",
        "adapter.plan",
        "codecs",
        "next.core.navigation",
        "fixture.stable.primary",
        "fixture.stable.matrix",
        "showcase.ui",
        "showcase.landing",
        "showcase.blog",
        "showcase.commerce",
        "showcase.field-atlas",
        "showcases.all",
        "example.mixed.full",
        "todo.build",
        "todo.smoke",
        "todo.e2e",
    }
    missing = sorted(required_ids - lane_by_id.keys())
    if missing:
        raise SecurityToolingFailure(
            "test-lane manifest lost required semantic owners: " + ", ".join(missing)
        )

    surfaces = manifest.get("productSurfaces")
    if not isinstance(surfaces, list):
        raise SecurityToolingFailure("test-lane manifest must contain product scorecards")
    surface_by_id = {
        surface.get("id"): surface
        for surface in surfaces
        if isinstance(surface, dict)
    }
    required_surfaces = {
        "repository-governance",
        "haxe-generation",
        "package-cli",
        "next-runtime",
        "react-next-semantics",
        "browser-applications",
        "maintained-examples",
        "compatibility-matrices",
    }
    if set(surface_by_id) != required_surfaces:
        raise SecurityToolingFailure(
            "test-lane manifest lost independent product-surface scorecards"
        )
    scored_lane_ids = {
        lane_id
        for surface in surfaces
        for lane_id in surface.get("laneIds", [])
    }
    if scored_lane_ids != set(lane_by_id):
        raise SecurityToolingFailure(
            "every test lane must belong to an independent product-surface scorecard"
        )

    examples = manifest.get("examples")
    if not isinstance(examples, list):
        raise SecurityToolingFailure("test-lane manifest must contain example tiers")
    example_tiers = {
        example.get("path"): example.get("tier")
        for example in examples
        if isinstance(example, dict)
    }
    expected_examples = {
        "examples/mixed-adoption": "capability-showcase",
        "examples/showcase-blog": "capability-showcase",
        "examples/showcase-commerce": "capability-showcase",
        "examples/showcase-field-atlas": "capability-showcase",
        "examples/showcase-landing": "capability-showcase",
        "examples/showcase-ui": "capability-showcase",
        "examples/todoapp-next": "flagship-application",
    }
    if example_tiers != expected_examples:
        raise SecurityToolingFailure("maintained example tiers drifted")
    for lane_id, lane in lane_by_id.items():
        groups = set(lane.get("groups", []))
        if lane.get("claimStatus") == "required":
            if not {"main", "nightly", "release"}.issubset(groups):
                raise SecurityToolingFailure(
                    f"claim-bearing lane {lane_id} lost a full backstop"
                )
            if lane.get("quarantine") is not None:
                raise SecurityToolingFailure(
                    f"quarantined lane {lane_id} cannot support a public claim"
                )
        if not isinstance(lane.get("timeoutSeconds"), int):
            raise SecurityToolingFailure(f"test lane {lane_id} has no timeout")
        if not str(lane.get("reproduction", "")).startswith("npm run "):
            raise SecurityToolingFailure(
                f"test lane {lane_id} has no bounded npm reproduction command"
            )

    primary = lane_by_id["fixture.stable.primary"]
    if "pr-primary" not in primary.get("groups", []):
        raise SecurityToolingFailure("the clean primary Next canary is not a PR owner")
    required_primary_evidence = {
        "haxe-positive",
        "cli",
        "ownership",
        "determinism",
        "strict-typescript",
        "next-build",
        "runtime",
    }
    if not required_primary_evidence.issubset(set(primary.get("evidence", []))):
        raise SecurityToolingFailure(
            "the primary Next canary no longer proves the full vertical path"
        )
    primary_environments = primary.get("environments")
    if primary_environments != [
        {
            "node": ["20.19.3"],
            "bundler": ["turbopack"],
            "profile": ["typescript/optimized"],
        }
    ]:
        raise SecurityToolingFailure("the primary PR canary environment drifted")

    matrix = lane_by_id["fixture.stable.matrix"]
    if matrix.get("environments") != [
        {
            "node": ["20.9.0", "24.18.0"],
            "bundler": ["turbopack", "webpack"],
            "profile": ["typescript/optimized"],
        }
    ]:
        raise SecurityToolingFailure(
            "the stable fixture matrix no longer matches the public support lanes"
        )
    if lane_by_id["loop.validate"].get("expansion") != "full":
        raise SecurityToolingFailure("selector changes must expand to full validation")


def validate_test_harness() -> None:
    validate_test_lane_topology()
    schema = read_json(HAXE_FIXTURES_SCHEMA)
    if schema.get("$id") != "https://nextjshx.dev/schemas/haxe-fixtures.schema.json":
        raise SecurityToolingFailure("Haxe fixture schema identity drifted")

    fixtures = read_json(HAXE_FIXTURES)
    if fixtures.get("$schema") != "../../schemas/haxe-fixtures.schema.json":
        raise SecurityToolingFailure("Haxe fixtures lost their local schema reference")
    positive = fixtures.get("positive")
    negative = fixtures.get("negative")
    if not isinstance(positive, list) or not isinstance(negative, list):
        raise SecurityToolingFailure("Haxe fixture contract must contain both evidence layers")
    expected_negative = {
        "exitCode": 1,
        "code": "NXHX-CONFIG-0001",
        "file": "tests/negative/diagnostic-contract/Main.hx",
        "line": 3,
        "characterStart": 3,
        "characterEnd": 27,
        "message": (
            "The baseline negative fixture deliberately rejects this declaration."
        ),
    }
    if not any(
        isinstance(item, dict)
        and item.get("id") == "next-stable-app-router"
        and item.get("build") == "tests/fixtures/next-stable/build.hxml"
        for item in positive
    ):
        raise SecurityToolingFailure("positive Haxe fixture baseline drifted")
    if not any(
        isinstance(item, dict)
        and item.get("id") == "generated-server-runtime"
        and item.get("build")
        == "tests/next-binding-pipeline/build-generated.hxml"
        for item in positive
    ):
        raise SecurityToolingFailure("generated binding Haxe fixture drifted")
    if not any(
        isinstance(item, dict)
        and item.get("id") == "diagnostic-contract"
        and item.get("expected") == expected_negative
        for item in negative
    ):
        raise SecurityToolingFailure("negative diagnostic-and-position baseline drifted")

    diagnostic_probe = read_text(ROOT / "tests/negative/support/DiagnosticProbe.hx")
    for fragment in ("NXHX-CONFIG-0001", "Context.currentPos()", "Context.error"):
        if fragment not in diagnostic_probe:
            raise SecurityToolingFailure(
                f"negative diagnostic probe lost required behavior: {fragment}"
            )

    stable_build = read_text(ROOT / "tests/fixtures/next-stable/build.hxml")
    for fragment in (
        "-D genes.ts",
        "-D genes.ts.no_extension",
        "-D genes.ts.jsx_import_source=react",
        "--macro include('app')",
        "-dce full",
    ):
        if fragment not in stable_build:
            raise SecurityToolingFailure(
                f"stable fixture lost its external-entry contract: {fragment}"
            )
    stable_adapter_plan = read_text(
        ROOT / "tests/fixtures/next-stable/haxe/next_stable/AdapterPlan.hx"
    )
    for fragment in (
        "PageLayoutMacro.install()",
        "RouteHandlerMacro.install()",
        "ProxyMacro.install()",
    ):
        if fragment not in stable_adapter_plan:
            raise SecurityToolingFailure(
                f"stable fixture lost annotation discovery: {fragment}"
            )
    for relative, annotation in (
        ("haxe/app/HaxePage.hx", '@:next.page("haxe")'),
        ("haxe/app/ProductPage.hx", '@:next.page("products/[slug]")'),
        ("haxe/app/RootLayout.hx", '@:next.layout("")'),
        ("haxe/request_proxy_fixture/RequestProxy.hx", "@:next.proxy"),
    ):
        declaration = read_text(ROOT / "tests/fixtures/next-stable" / relative)
        if annotation not in declaration:
            raise SecurityToolingFailure(
                f"stable fixture declaration lost its App Router annotation: {relative}"
            )
        if "@:keep" in declaration:
            raise SecurityToolingFailure(
                f"stable fixture must rely on macro-owned DCE retention: {relative}"
            )
    fixture_main = read_text(ROOT / "tests/fixtures/next-stable/haxe/FixtureMain.hx")
    if any(
        name in fixture_main
        for name in ("HaxePage", "RootLayout", "EchoRoute", "RequestProxy")
    ):
        raise SecurityToolingFailure("stable fixture restored a fake Haxe reachability call")

    compiler_gap_builds = {
        "tests/compiler-gaps/build-typescript.hxml": ("-D genes.ts", "-dce full"),
        "tests/compiler-gaps/build-classic.hxml": ("-D dts", "-dce full"),
    }
    for relative, fragments in compiler_gap_builds.items():
        source = read_text(ROOT / relative)
        for fragment in fragments:
            if fragment not in source:
                raise SecurityToolingFailure(
                    f"{relative} lost dual-output gap evidence: {fragment}"
                )

    for label, config_path, require_no_emit_on_error in (
        ("stable Next fixture", NEXT_FIXTURE_TSCONFIG, False),
        ("production todo app", TODO_APP_TSCONFIG, False),
        ("packed consumer", PACKAGE_SHAPE_TSCONFIG, True),
        ("compiler-gap TypeScript profile", COMPILER_GAPS_TS_TSCONFIG, False),
        ("compiler-gap classic consumer", COMPILER_GAPS_CLASSIC_TSCONFIG, False),
        ("Next core/navigation parity fixture", NEXT_CORE_NAVIGATION_TSCONFIG, False),
        ("Next component TSX parity fixture", NEXT_COMPONENTS_TSCONFIG, False),
        ("shared showcase UI source", SHOWCASE_UI_TSCONFIG, True),
        ("shared showcase UI HXX fixture", SHOWCASE_UI_FIXTURE_TSCONFIG, True),
        (
            "landing showcase",
            ROOT / "examples/showcase-landing/tsconfig.json",
            False,
        ),
        ("blog showcase", ROOT / "examples/showcase-blog/tsconfig.json", False),
        (
            "commerce showcase",
            ROOT / "examples/showcase-commerce/tsconfig.json",
            False,
        ),
        ("mixed adoption example", MIXED_ADOPTION_TSCONFIG, False),
        ("Next server Route Handler parity fixture", NEXT_SERVER_TSCONFIG, False),
        ("semantic codec fixture", CODECS_TSCONFIG, False),
        ("metadata and segment config fixture", METADATA_SEGMENT_TSCONFIG, False),
        ("typed route-href fixture", ROUTE_HREFS_TSCONFIG, False),
        (
            "environment boundary Next fixture",
            ENVIRONMENT_BOUNDARIES_TSCONFIG,
            False,
        ),
        ("Server Function Next fixture", SERVER_FUNCTIONS_TSCONFIG, False),
        ("Cache Components Next fixture", CACHE_BOUNDARIES_TSCONFIG, False),
    ):
        config = read_json(config_path)
        options = config.get("compilerOptions")
        if not isinstance(options, dict):
            raise SecurityToolingFailure(f"{label} has no TypeScript compiler options")
        if options.get("strict") is not True or options.get("skipLibCheck") is not False:
            raise SecurityToolingFailure(
                f"{label} must retain strict TypeScript with library checks enabled"
            )
        if require_no_emit_on_error and options.get("noEmitOnError") is not True:
            raise SecurityToolingFailure(f"{label} must refuse emission on type errors")

    artifact = read_json(PACKAGE_SHAPE_ARTIFACT)
    if (
        artifact.get("name") != "@nextjshx/package-shape-fixture"
        or artifact.get("version") != "0.0.0"
        or artifact.get("files") != ["dist"]
        or "scripts" in artifact
        or "dependencies" in artifact
    ):
        raise SecurityToolingFailure("local package-shape artifact contract drifted")

    harness_fragments = {
        "scripts/testing/haxe-fixtures.mjs": (
            "must emit exactly one NXHX diagnostic",
            "characterStart",
            "characterEnd",
            "Ajv2020",
        ),
        "scripts/testing/adapter-plan.mjs": (
            "registration order changed adapter-plan bytes",
            "adapter-plan schema accepted",
            "the CLI adapter-plan output define was ignored",
            "--no-output unexpectedly published application JavaScript",
            "NXHX-PLAN-DUPLICATE-0001",
        ),
        "scripts/testing/route-patterns.mjs": (
            "route registration order changed the canonical route model",
            "--no-output unexpectedly published application JavaScript",
            "NXHX-ROUTE-PARAM-MISSING-0001",
            "NXHX-ROUTE-CODEC-0001",
        ),
        "scripts/testing/route-hrefs.mjs": (
            "generated route helper class",
            "server and client route expansion drifted",
            "ordinary concatenation widened the typed href",
            "new URLSearchParams()",
            "query fields lost canonical bytewise key order",
            "anonymous sparse query fields lost their exact closed emitted types",
            "compile-time-only sparse route/query declarations emitted an unnecessary runtime module",
            "query_forged_string",
            "query_mutable",
            "query_path_arity",
            "13 path/query and shared-consumer assertions",
            "tracked parity source lost",
            "native route-group shape",
            "tsconfig.route-negative.json",
            "not-in-next-route-graph",
            "href_extra",
        ),
        "scripts/testing/environment-boundaries.mjs": (
            "compileDeterministically",
            'const marker = `import "${specifier}"`',
            '"server-only"',
            '"client-only"',
            "NXHX-BOUNDARY-REQUEST-0003",
            "NXHX-BOUNDARY-IMPORT-0002",
            "NXHX-BOUNDARY-METADATA-0001",
            "server environment key reached a browser chunk",
            "marker injection replaced the owner's existing static initializer",
            "cannot be imported from a Client Component module",
            "strict TypeScript",
        ),
        "scripts/testing/clientification-boundaries.mjs": (
            "next-observed",
            "smallest interactive leaf",
            "server-rendered content",
            "high.nextArtifacts.bytes > leaf.nextArtifacts.bytes",
            "clientification.shared.FeatureCatalogue",
            "machine-local root",
            "boundary report bytes changed",
        ),
        "scripts/testing/client-components.mjs": (
            "verifyPlanAndDeterminism",
            "NXHX-SERIALIZABLE-PROP-0001",
            "NXHX-BOUNDARY-IMPORT-0002",
            "NXHX-REACT-HOOK-0002",
            "NXHX-REACT-USE-0003",
            "NXHX-REACT-PURITY-0004",
            "GTS-REACT-STATE-001",
            "GTS-REACT-DEPS-001",
            "GTS-REACT-DEPS-002",
            "NXHX-REACT-EXPORT-0002",
            "react-hooks/exhaustive-deps",
            "react-hooks/rules-of-hooks",
            "react-hooks/purity",
            "uncached-react-use",
            'adapter.split(/\\r?\\n/)[0], \'"use client";\'',
            "Parameters<typeof import(",
            "typeof GenericHooks.useSelection",
            "strict Next production build",
            "failedResponses",
            "client-counter-button",
        ),
        "scripts/testing/server-functions.mjs": (
            "verifyPlanAndDeterminism",
            "NXHX-SERVER-FUNCTION-ASYNC-0004",
            "NXHX-SERVER-FUNCTION-SERIALIZABLE-0005",
            "NXHX-BOUNDARY-IMPORT-0002",
            'action.split(/\\r?\\n/)[0], \'"use server";\'',
            "export async function save(",
            "Server Function POST returned",
            "actionCookie.httpOnly",
            'actionCookie.sameSite, "Lax"',
            "strict Next production build",
        ),
        "scripts/testing/cache-boundaries.mjs": (
            "verifyPlanAndDeterminism",
            "NXHX-CACHE-REQUEST-0006",
            "NXHX-CACHE-CAPABILITY-0001",
            "NXHX-CACHE-SERIALIZABLE-0005",
            "NXHX-BOUNDARY-IMPORT-0002",
            '"raw-implementation"',
            'modulePage.split(/\\r?\\n/)[0], \'"use cache";\'',
            '"use cache: private"',
            '"use cache: remote"',
            "export default async function NextJsHxDefault(",
            "Next build rewrote authored configuration",
            "unchanged (7)",
            "same cache key recomputed unexpectedly",
            "revalidateTag did not expire the tagged cached value",
        ),
        "src/nextjshx/cache/CacheFunctionMacro.hx": (
            "Compiler.addGlobalMetadata",
            "NXHX-CACHE-FUNCTION-0004",
            "NXHX-CACHE-REF-0007",
            "CacheSerializableMacro.validateArgument",
            'type.meta.add(":keep"',
            "genes.ts.Imports.namedImport",
        ),
        "src/nextjshx/cache/CacheDirectiveMacro.hx": (
            "nextjshx.cache-components",
            "nextjshx.experimental.cache-private",
            "nextjshx.experimental.cache-remote",
            'directive: "use cache"',
            'directive: "use cache: private"',
            'directive: "use cache: remote"',
        ),
        "src/nextjshx/server/ServerFunctionMacro.hx": (
            "Compiler.addGlobalMetadata",
            "NXHX-SERVER-FUNCTION-ASYNC-0004",
            "NXHX-SERVER-FUNCTION-REF-0006",
            'directives: ["use server"]',
            'type.meta.add(":keep"',
            "genes.ts.Imports.namedImport",
        ),
        "src/nextjs/codec/FormDataDecoder.hx": (
            "serverAction",
            'name.startsWith("$ACTION_")',
            "DecodeIssueCode.UnexpectedField",
        ),
        "src/nextjshx/boundary/EnvironmentBoundaryMacro.hx": (
            "Compiler.addGlobalMetadata",
            "genes.ts.Imports.sideEffect",
            "NXHX-BOUNDARY-METADATA-0001",
            "NXHX-BOUNDARY-IMPORT-0002",
            "NXHX-BOUNDARY-REQUEST-0003",
            "NXHX-CACHE-REQUEST-0006",
            "Context.onAfterTyping",
            'type.meta.add(":keep"',
        ),
        "src/nextjs/env/ServerEnvironment.hx": (
            "@:next.serverOnly",
            "Undefinable<String>",
            "NodeProcess.env.get(name)",
            '@:jsRequire("node:process")',
        ),
        "tests/route-hrefs/next-app/app/route-parity.tsx": (
            'Route<"/archive/">',
            'Route<"/catalog/nextjshx-probe">',
            'Route<"/docs/nextjshx-probe/tail">',
            'Route<"/todos/nextjshx-probe?page=2&tag=haxe">',
            '"/teams/nextjshx-probe/members/nextjshx-probe"',
        ),
        "tests/route-hrefs/next-app/route-parity-negative.ts": (
            'Route<"/not-in-next-route-graph">',
            '"/not-in-next-route-graph"',
        ),
        "tests/route-hrefs/next-app/tsconfig.route-negative.json": (
            '"extends": "./tsconfig.json"',
            '"incremental": false',
            '".next/types/**/*.ts"',
        ),
        "tools/cli/src/config.ts": (
            "CONFIG_SCHEMA_VERSION = 2",
            "LEGACY_CONFIG_SCHEMA_VERSION = 1",
            "effectiveOutputProfile",
            "effectiveHaxeDefines",
            "assertClosedKeys",
            "JSON.parse(source)",
            "NXHX-CONFIG-PATH-0008",
            "experimentalCacheDirectivesValue",
            "isCompilerOwnedDefine",
            'name.startsWith("nextjshx.")',
        ),
        "tools/cli/src/discovery.ts": (
            "findWorkspaceRoot",
            "discoverPackageManager",
            "realpathSync.native",
            "NXHX-CONFIG-SYMLINK-0015",
        ),
        "tools/cli/test/config-discovery.test.ts": (
            "Ajv2020",
            "distinguishes a pnpm workspace root",
            "requireConfig: false",
            "NXHX-CONFIG-PACKAGE-MANAGER-0012",
        ),
        "tools/cli/src/manifest.ts": (
            'OUTPUT_MANIFEST_PROTOCOL = "nextjshx.generated-output"',
            "manifestGeneration",
            "assertCanonicalOutputs",
            "NXHX-OWNERSHIP-GENERATION-0011",
        ),
        "tools/cli/src/ownership-preflight.ts": (
            "preflightGeneratedOutputs",
            "allowedOutputRoots",
            "allowedOutputFiles",
            "canonicalAllowedFiles",
            "fileSha256",
            "NXHX-OWNERSHIP-UNOWNED-0008",
            "NXHX-OWNERSHIP-MODIFIED-0009",
        ),
        "tools/cli/test/ownership-preflight.test.ts": (
            "classifies verified create, update, unchanged, and remove states",
            "existing unowned target even when its bytes match",
            "symlink targets, parent traversal, and allowlisted roots",
            "NXHX-OWNERSHIP-GENERATION-0011",
            "without granting its sibling directory",
        ),
        "tools/cli/src/publication-journal.ts": (
            "nextjshx.generated-output-transaction",
            "assertKeys",
            "validateOutputPath",
            "withPublicationPhase",
            "allowedOutputFiles",
        ),
        "tools/cli/src/publisher.ts": (
            "publishGeneratedOutputs",
            "recoverGeneratedOutputPublication",
            "linkSync",
            "assertRecoverableState",
            "post-publication validation failed",
        ),
        "tools/cli/test/publication.test.ts": (
            "manifest last",
            "without rewriting unchanged files",
            "recovers a simulated crash",
            "resumes a second crash",
            "unexpected live file",
            "concurrent publishers cannot race",
            "src/unrelated.ts",
        ),
        "tools/cli/src/adapter-plan.ts": (
            "parseAdapterPlan",
            "exactKeys",
            "strict canonical bytewise order",
            "O_NOFOLLOW",
            "NXHX-CLI-PLAN-0004",
        ),
        "tools/cli/src/adapter-renderer.ts": (
            "safeSignature",
            "AnyKeyword",
            "UnknownKeyword",
            "NextJsHxDefault",
            'intent.kind === "error"',
            "exactly use client",
            'new Set(["metadata", "generateMetadata", "generateStaticParams"])',
            "exactly 16.2.12 for the reviewed stable segment-config contract",
            "false or a non-negative integer literal",
            "proxyOutputPathForAppRoot",
            "validateProxyIntent",
            '"ProxyConfig"',
            "validateReactHookIntent",
            'intent.kind !== "react-hook"',
            "validateServerFunctionIntent",
            'intent.kind === "server-function"',
            'intent.kind === "cache-function"',
            "validateCacheFunctionIntent",
            'intent.kind === "default"',
            "the root of one named parallel slot",
            '"use cache: private"',
            '"use cache: remote"',
            "export async function",
        ),
        "tools/cli/src/commands.ts": (
            "nextjshx.adapter-plan-output",
            "requireCurrentGeneratedTree",
            "Next route type generation",
            "DEFAULT_APP_ROUTE_EXTENSIONS",
            "nativeRouteCandidates",
            "validateParallelSlotDefaults",
            "An intercepted view has no canonical hard-navigation page",
            "routeParitySource",
            'flag: "wx"',
            "does not follow symbolic links",
            "NEXT_UPSTREAM_COMMIT",
            "inspectGeneratedRoot",
            "Skipping validation of types",
            "source: \"next-build\"",
            "--experimental-upload-trace",
        ),
        "tools/cli/src/init.ts": (
            "runInitCommand",
            "NXHX-CLI-INIT-0015",
            "O_EXCL",
            "sha256(previousBytes)",
            "existing executable Next config requires a manual reviewed typedRoutes patch",
            '"nextjshx dev --"',
            '"--no-output"',
            '"NextJsHx Haxe library"',
            "Publish the package patch last",
        ),
        "tools/cli/test/init.test.ts": (
            "byte-stable new-app baseline",
            "without changing the lockfile",
            "never follows a symbolic-link Haxe parent",
            "preserves native routes, scripts, executable config, and conflicting files",
            "explicit typed routes creates matching Next and NextJsHx configuration",
            "requires the NextJsHx Haxe library before writing any baseline file",
            "interrupted init preserves a colliding temporary",
            "generated new-app baseline compiles and publishes through the real Haxe toolchain",
        ),
        "scripts/examples/mixed-adoption.mjs": (
            "verifyInitPreservesNative",
            "verifyOwnershipCollision",
            "NXHX-SERIALIZABLE-PROP-0001",
            "verifyReactLint",
            "verifyGeneratedShape",
            "verifyBrowser",
        ),
        "examples/mixed-adoption/app/native-bridge-deck.tsx": (
            '"use client"',
            "HaxePatchConsole",
            "useBridgeChannel",
            "haxeInteropLabel",
        ),
        "examples/mixed-adoption/haxe/mixed_adoption/native/NativeSignal.hx": (
            "NativeSignalHook",
            "NativeSignalFormat",
            "NativeSignalCard",
            "@:genes.jsxComponentProps",
        ),
        "examples/mixed-adoption/haxe/mixed_adoption/client/HaxeHooks.hx": (
            "@:next.hook",
            "@:next.exportHook",
            "useBridgeChannel",
        ),
        "examples/mixed-adoption/haxe/mixed_adoption/InteropExports.hx": (
            "@:expose",
            "haxeInteropLabel",
            "No React adapter or wrapper",
        ),
        "tests/mixed-adoption/negative/mixed_adoption_negative/UnsafeCallbackProps.hx": (
            "@:next.clientComponent",
            "onCommit",
            "Server-to-Client",
        ),
        "tools/cli/src/cli.ts": (
            "nextjshx init",
            "nextjshx generate",
            "nextjshx build",
            "--no-check",
            "--json",
            "commandErrorJson",
            "machineResult",
            "topology=${route.topology}",
            "interception=${interception}",
        ),
        "tools/cli/test/adapter-plan-renderer.test.ts": (
            "rejects TypeScript signature injection",
            "non-canonical collection order",
            "broad types",
            "without following a symbolic link",
            "client directive as its first statement",
            "directive-first native Server Function wrappers",
            "weakened Server Function directives",
            "cache directives inside precise async function wrappers",
            "module-level cache directive before an async page wrapper",
            "weakened cached-function directives",
        ),
        "tools/cli/test/commands.test.ts": (
            "create/update/unchanged/remove",
            "live adapters and manifest untouched when Haxe fails",
            "restores exact previous bytes",
            "refuse to validate an unpublished adapter tree",
            "explicitly configured Next source oracle",
            "fails closed across Haxe, ownership, strict TypeScript, and Next",
            "requires Next's own TypeScript phase",
            "generated tree containing a symlink",
            "routes models native parallel and intercepted views without stealing canonical ownership",
            "routes rejects an intercepted view without its canonical hard-navigation page",
            "generation rejects a Next 16 parallel slot without an explicit default",
            "routes rejects route-group aliases that claim one canonical public URL",
            "human route output makes filesystem topology explicit",
            "checked routes rejects a per-pattern Next parity failure and removes probes",
            "failed parity validation left private probe artifacts behind",
            'route.origin === "native"',
            "refuses an existing native proxy",
            "stable machine JSON",
        ),
        "scripts/fixtures/next-stable.mjs": (
            '[CLI_BIN, "build", "--", bundlerFlag]',
            'bundlerFlag !== "--turbopack" && bundlerFlag !== "--webpack"',
            "verifyOwnedAdapters",
            "GENERATED_LAYOUT_ADAPTER",
            "next-stable-haxe-layout.tsx",
            "GENERATED_INTERCEPTED_PHOTO_ADAPTER",
            "next-stable-haxe-intercepted-photo.tsx",
            "GENERATED_MODAL_DEFAULT_ADAPTER",
            "next-stable-haxe-modal-default.tsx",
            "GENERATED_LOADING_ADAPTER",
            "next-stable-haxe-error.tsx",
            'LayoutProps<"/">',
            '["/", "/haxe", "/products/first"]',
            "GENERATED_PRODUCT_ADAPTER",
            "GENERATED_PROXY_ADAPTER",
            "next-stable-haxe-proxy.ts",
            "x-nextjshx-proxy",
            "next-stable-haxe-product.tsx",
            "streamedLoadingProof",
            "notFoundProof",
            "staticParamsProof",
            "browserNavigationProofs",
            "intercepted photo used a modal on soft navigation",
            "/api/echo/alpha",
            "/api/echo/beta",
            "/api/echo/gamma",
            "contains a TypeScript cast",
            "removeCliOwnedSourceState",
        ),
        "scripts/examples/todoapp-next.mjs": (
            "assertNodeVersion",
            "exactNode: true",
            "parseState",
            "todoapp-state.tsv",
            "mode: 0o600",
            "assertNoTypeScriptEscape",
            "rootHtml.includes('href=\"/todos/shape-first-release\"')",
            "should remain a direct node:fs extern without a generated module",
            '[CLI_BIN, "build", "--", "--turbopack"]',
            "Runtime state won the read",
            "NEXT_HTTP_ERROR_FALLBACK;404",
            "todo-not-found",
            "chromium.launch",
            "useActionState",
            "app/actions/todos.ts",
            "app/_nextjshx/cache/todos/list.ts",
            "app/api/todos/route.ts",
            "app/_nextjshx/client/ec33c886dc20/CreateTodoForm.tsx",
            "app/_nextjshx/client/af0bcfc585a9/FailureRecoveryProbe.tsx",
            "app/todos/error.tsx",
            "malformed JSON lost its exact typed error body",
            "tag invalidation did not update the visible cached list",
            "typed API errors/context, visible cache invalidation",
            "NEXTJSHX_TODO_RUN_ID",
            "smoke run root must be owner-only",
        ),
        "playwright.config.mjs": (
            "fullyParallel: false",
            "workers: 1",
            "retries: 0",
            'trace: "retain-on-failure"',
            'screenshot: "only-on-failure"',
            "NEXTJSHX_CHROME must be an absolute browser executable path",
        ),
        "tests/e2e/todoapp-next.spec.mjs": (
            "NEXTJSHX_TODO_RUN_ID",
            "todoapp-state.tsv",
            "mode: 0o600",
            "playwright/test",
            "observeDiagnostics",
            "HYDRATION_DIAGNOSTIC",
            "requestfailed",
            "streams loading UI",
            "fails malformed API input closed",
            "makes cache invalidation visible",
            "validates and executes create, detail, toggle, and delete Server Actions",
            "renders useful List and Board states when the persisted ledger is empty",
            "FIELD_LEDGER_RECOVERABLE_RENDER",
            "recovers through the typed Haxe reset",
        ),
        "src/nextjshx/adapter/AdapterPlanRegistry.hx": (
            "Context.onAfterTyping",
            "Context.onAfterGenerate",
            "preparePlan",
            "writePlan",
        ),
        "src/nextjshx/app/PageLayoutMacro.hx": (
            "Compiler.addGlobalMetadata",
            "RouteParameterValidator.validate",
            "NXHX-PAGE-LAYOUT-PROPS-0005",
            "PageProps",
            "LayoutProps",
            "NXHX-PAGE-LAYOUT-METADATA-0008",
            "NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009",
            "RouteHrefMacro.build",
            'entry.name == ":next.query"',
            "QuerySchemaValidator.fromMetadata",
            "hrefWithQueryField",
            "RouteQueryMacro.build",
            "does not decode URL input",
            "NXHX-PAGE-LAYOUT-SLOTS-0010",
            "LAYOUT_SLOTS_METADATA",
            "slottedLayoutParams",
            'type.meta.add(":keep"',
        ),
        "src/nextjshx/app/SegmentConfigMacro.hx": (
            "SegmentConfig.create({...})",
            "runtime",
            "preferredRegion",
            "dynamicParams",
            "revalidate",
            "maxDuration",
            "NXHX-SEGMENT-CONFIG-0001",
            "compile-time-only",
        ),
        "scripts/testing/page-layouts.mjs": (
            "canonical/grouped/parallel/intercepted pages",
            "typed parallel-slot layouts",
            "NXHX-PAGE-LAYOUT-RENDER-0004",
            "page_layout_case=query-mutation",
            "static hrefWithQuery",
            "new URLSearchParams()",
            "Page/layout plan contains a broad TypeScript type",
            "query mutation emitted a rejected plan",
        ),
        "src/nextjshx/route/QuerySchemaValidator.hx": (
            "NXHX-ROUTE-QUERY-SCHEMA-0001",
            "NXHX-ROUTE-QUERY-FIELD-0002",
            "NXHX-ROUTE-QUERY-CODEC-0003",
            "!field.isPublic || !field.isFinal",
            'reference.get().module == "genes.ts.Undefinable"',
            "bindings.sort",
        ),
        "src/nextjshx/route/RouteQueryMacro.hx": (
            "RoutePatternMacro.parse",
            "requires exact params followed by the query value",
            "new nextjs.raw.server.WebSearchParams()",
            "genes.ts.Undefinable.isAbsent",
            "QueryFieldCardinality.Repeated",
            "encodedValue == \"\"",
        ),
        "src/nextjshx/route/RoutePatternType.hx": (
            "Shared safe TypeScript literal projection",
            "Json.stringify(pattern.publicPath)",
            "RouteSegmentKind.OptionalCatchAll",
        ),
        "src/nextjs/route/RouteHrefWithQuery.hx": (
            "import('next').Route<$0 | `${Extract<$0, string>}?${string}`>",
            "private static inline function fromValidatedString",
        ),
        "tests/fixtures/next-stable/haxe/app/ProductQuery.hx": (
            "@:structInit",
            "public final page:Int",
            "import genes.ts.Undefinable",
            "public final preview:Undefinable<Bool>",
            '@:next.queryName("tag")',
        ),
        "tests/fixtures/next-stable/haxe/app/HaxePage.hx": (
            "ProductPage.hrefWithQuery",
            'tags: ["haxe next", "typed"]',
            'id={"typed-query-link"}',
        ),
        "scripts/testing/metadata-segment.mjs": (
            "static/generated metadata",
            "route-matched static params",
            "erased literal config",
            "strict adapters",
            "NXHX-PAGE-LAYOUT-METADATA-0008",
            "NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009",
            "NXHX-SEGMENT-CONFIG-0001",
        ),
        "tests/snapshots/next-stable-haxe-product.tsx": (
            "generateMetadata",
            "generateStaticParams",
            "dynamicParams = false",
            'preferredRegion = ["iad1", "sfo1"]',
        ),
        "src/nextjshx/route/RouteHandlerMacro.hx": (
            "Compiler.addGlobalMetadata",
            "RouteParameterValidator.validate",
            "NXHX-ROUTE-HANDLER-DUPLICATE-0008",
            "Promise<globalThis.Response>",
            'type.meta.add(":keep"',
        ),
        "scripts/testing/route-handlers.mjs": (
            "GET/POST/DELETE plan",
            "NXHX-ROUTE-HANDLER-DUPLICATE-0008",
            "NXHX-ROUTE-HANDLER-CONTEXT-0005",
            "Route Handler plan contains a broad TypeScript type",
        ),
        "src/nextjshx/app/SpecialFileMacro.hx": (
            "Compiler.addGlobalMetadata",
            "NXHX-SPECIAL-ERROR-PROPS-0005",
            "NXHX-SPECIAL-ERROR-ASYNC-0007",
            "NXHX-SPECIAL-DEFAULT-PATH-0009",
            "declarations.push({kind: DefaultFallback",
            'new AdapterImport("react", "JSX", null, true)',
            'directives: value.kind == ErrorBoundary ? ["use client"] : []',
            'type.meta.add(":keep"',
        ),
        "src/nextjshx/server/ProxyMacro.hx": (
            "Compiler.addGlobalMetadata",
            "NXHX-PROXY-SIGNATURE-0004",
            "NXHX-PROXY-MATCHER-0003",
            'new AdapterImport("next/server", "NextProxy"',
            'type.meta.add(":keep"',
        ),
        "src/nextjs/proxy/ProxyRequest.hx": (
            "ProxyRequestHeaders",
            "ProxyRequestCookies",
            "ProxyUrl",
            "Promise<Unknown>",
            "raw `NextRequest`",
        ),
        "src/nextjs/proxy/ProxyResponse.hx": (
            "ProxyResponseHeaders",
            'NextResponse<unknown>',
            "static function next():ProxyResponse",
            "raw",
        ),
        "scripts/testing/proxy.mjs": (
            "typed matcher/no-config plans",
            "NEGATIVE_CASES.length",
            "strict generated TypeScript",
            "Proxy plan contains a broad type",
        ),
        "scripts/testing/special-files.mjs": (
            "loading/error/not-found/default plans",
            "typed slot params",
            "NXHX-SPECIAL-ERROR-PROPS-0005",
            "NXHX-SPECIAL-ERROR-ASYNC-0007",
            "NXHX-SPECIAL-DEFAULT-PATH-0009",
            "Special-file plan contains a broad TypeScript type",
            "strict TypeScript",
        ),
        "scripts/testing/snapshots.mjs": (
            "snapshot updates are disabled in CI",
            "missing",
            "extra",
            "mismatch",
        ),
        "scripts/testing/package-shape.mjs": (
            '"--ignore-scripts"',
            '"--offline"',
            "packed file allowlist drifted",
            "TSC_BIN",
        ),
        "scripts/testing/compiler-gaps.mjs": (
            "verifyFrameworkNeutralSource",
            "lost the generic module directive",
            "unexpectedly gained a default export",
            "UnretainedEntry",
        ),
        "scripts/bindings/next-surface.mjs": (
            "EXPECTED_ENTRYPOINT_PRIORITIES",
            "selected declaration escaped the reviewed packages",
            "compatibilityPromise: false",
            "surface updates are disabled in CI",
            "assertExpectedHashes",
            "candidate mode requires --next-package-root",
            "allowKindDrift",
        ),
        "scripts/testing/next-surface.mjs": (
            "normalized output depends on allowlist array order",
            "missing-export",
            "wrong-kind",
            "signature-drift",
            "runtimeImportAllowed",
            "Request must remain the pinned DOM contract",
        ),
        "scripts/bindings/sync-next-bindings.mjs": (
            "ALLOWED_TYPE_CONSTRUCTS",
            "map-any-to-genes-unknown",
            "assertImplementationPolicy",
            "NXHX-DRIFT-CURATED-EXTERN-CHANGED",
            "generation stopped before emitting Haxe",
            "acceptedTransitions",
            "NXHX-DRIFT-EXPORT-REMOVED",
            "binding updates are disabled in CI",
            "buildCandidateIR",
            "candidate mode requires --next-package-root",
            "NXHX-DRIFT-UNSUPPORTED-CONSTRUCT",
            "unsupportedConstructs",
        ),
        "scripts/bindings/next-compatibility.mjs": (
            "NEXTJSHX_NEXT_PACKAGE_DIR",
            "candidate surface",
            "classifier exited",
            'runNode(SURFACE_SCRIPT, ["check"])',
            "next-${options.lane}-drift",
            "has no built dist declarations",
        ),
        "scripts/testing/next-drift.mjs": (
            "blocking stable report",
            "removed-export report lost its owning binding or fixture",
            "kind-drift report lost its owning binding or fixture",
            "unsupported candidate construct did not produce an actionable classified report",
            "actionable unbuilt-checkout diagnostics",
            "equivalent internal declaration move was not classified compatibly",
            "NXHX-DRIFT-DECLARATION-MOVED",
        ),
        "scripts/testing/next-bindings.mjs": (
            "repeated declaration ingestion changed IR bytes",
            "65 curated B03-B05 symbols",
            "reviewed override snapshot drifted",
            "unsupported-mapped.d.ts",
            "NXHX-DRIFT-DECLARATION-MOVED",
            "NXHX-DRIFT-EXPORT-ADDED",
            "NXHX-DRIFT-DOCUMENTATION-CHANGED",
            "NXHX-DRIFT-EXPORT-REMOVED",
            "NXHX-DRIFT-CURATED-EXTERN-CHANGED",
            "Refusing update without acceptedTransitions entry",
            "build-generated-typescript.hxml",
            "genes-ts widened the exact Next ServerRuntime union",
            "failed strict TypeScript validation",
        ),
        "scripts/testing/next-core-navigation.mjs": (
            "Navigation.usePathname()",
            "B03 consumer widened a boundary to TypeScript any",
            "lost its non-returning TypeScript contract",
            "has no field set",
            "notAValidTitle",
            "useParams generic constraint was not enforced",
            "RedirectType\\.(?:push|replace) as",
        ),
        "scripts/testing/next-components.mjs": (
            "18 direct-import exports",
            "B04 widened a boundary to TypeScript any",
            "became a runtime wrapper import",
            "Object requires field href",
            "Object requires field alt",
            "Property 'action' is missing",
            "not assignable to type '`--\\$\\{string\\}`'",
            "Suspense",
        ),
        "scripts/testing/next-server.mjs": (
            "27 P0 Web/server exports",
            "B05 widened a generated boundary to TypeScript any",
            "became a local runtime wrapper import",
            "ReadonlyHeaders has no field set",
            "ReadonlyRequestCookies has no field set",
            "genes\\.ts\\.Unknown should be String",
            "upstream JSON-any negative control",
        ),
        "src/nextjs/codec/RequestDecoder.hx": (
            "DecodeIssueCode.InvalidJson",
            "DecodeIssueCode.InvalidFormData",
            "request body must contain valid JSON",
            "request body must contain valid form data",
        ),
        "src/nextjs/codec/ResponseJson.hx": (
            "genes.ts.Json.value",
            "NextResponse.json",
            "status < 400 || status > 599",
        ),
        "scripts/testing/codecs.mjs": (
            "exact JSON/form/query decoding",
            "Register.unsafeCast",
            "build-negative-response.hxml",
            "build-negative-boundary.hxml",
            "9 malformed runtime controls",
        ),
    }
    for relative, fragments in harness_fragments.items():
        source = read_text(ROOT / relative)
        for fragment in fragments:
            if fragment not in source:
                raise SecurityToolingFailure(
                    f"{relative} lost required harness behavior: {fragment}"
                )
    ownership_preflight = read_text(ROOT / "tools/cli/src/ownership-preflight.ts")
    for forbidden_mutation in (
        r"\bwriteFile(?:Sync)?\s*\(",
        r"\bmkdir(?:Sync)?\s*\(",
        r"\brename(?:Sync)?\s*\(",
        r"\brm(?:Sync)?\s*\(",
        r"\bunlink(?:Sync)?\s*\(",
        r"\btruncate(?:Sync)?\s*\(",
    ):
        if re.search(forbidden_mutation, ownership_preflight):
            raise SecurityToolingFailure(
                "pure ownership preflight gained filesystem mutation: "
                + forbidden_mutation
            )


def validate_docs_and_modes() -> None:
    agent_instructions = read_text(ROOT / "AGENTS.md")
    for fragment in (
        "Oracle second-opinion review with GPT-5.6 Pro",
        "detailed prompt",
        "Repomix bundle",
        "one ZIP for upload",
        "Never upload or submit the bundle without explicit user",
    ):
        if fragment not in agent_instructions:
            raise SecurityToolingFailure(
                f"AGENTS.md lost deep-review packaging guidance: {fragment}"
            )

    security = read_text(ROOT / "SECURITY.md")
    for fragment in (
        "https://github.com/fullofcaffeine/nextjshx/security/advisories/new",
        "boss@fullofcaffeine.com",
        "There is no published or supported release",
        "must be enabled and verified",
        "npm run public:preflight",
        "npm run beads:push",
    ):
        if fragment not in security:
            raise SecurityToolingFailure(f"SECURITY.md lost required statement: {fragment}")
    contributing = read_text(ROOT / "CONTRIBUTING.md")
    for fragment in (
        "npm run test:cache-boundaries",
        "npm run test:example:todoapp:e2e",
        "Keep shared, private, and remote capabilities",
        "explicit; put request reads outside shared/remote functions",
        "a parallel cache runtime",
        "silently rewrite native Next configuration",
        "Playwright retries at zero",
        "Never add a broad console or network-error allowlist",
        "npm run drift:next:stable",
        "npm run drift:next:upstream",
        "exact owner and fixture",
    ):
        if fragment not in contributing:
            raise SecurityToolingFailure(
                f"CONTRIBUTING.md lost cache review guidance: {fragment}"
            )
    readme = read_text(README)
    for fragment in (
        "support_matrix.json",
        "npx --no-install lix download",
        "npm test",
        "docs/README.md",
        "docs/architecture.md",
        "npm run public:preflight",
    ):
        if fragment not in readme:
            raise SecurityToolingFailure(
                f"README.md lost front-door guidance: {fragment}"
            )

    documentation = "\n".join(
        read_text(path) for path in sorted(DOCS_ROOT.rglob("*.md"))
    )
    for fragment in (
        "npm run test:support-matrix",
        "npm run support:discover",
        "npm run test:fixture:next-stable",
        "npm run test:fixture:next-stable:smoke",
        "npm run test:example:todoapp",
        "npm run test:example:todoapp:e2e",
        "npm run test:showcase-ui",
        "npm run test:showcases",
        "npm run integrations:check",
        "npm run test:integrations",
        "npm run test:harness",
        "npm run test:adapter-plan",
        "npm run test:routes",
        "npm run test:page-layouts",
        "npm run test:metadata-segment",
        "npm run test:route-handlers",
        "npm run test:special-files",
        "npm run test:proxy",
        "npm run test:route-hrefs",
        "npm run test:environment-boundaries",
        "npm run test:client-components",
        "npm run test:server-functions",
        "npm run test:cache-boundaries",
        "npm run test:config-discovery",
        "npm run test:ownership-preflight",
        "npm run test:publication",
        "npm run test:cli",
        "npm run test:dev",
        "npm run test:next-bindings",
        "npm run test:next-drift",
        "npm run drift:next:stable",
        "npm run drift:next:upstream",
        "NEXTJSHX_NEXT_PACKAGE_DIR",
        "npm run test:next-core-navigation",
        "npm run test:next-components",
        "npm run test:showcase-ui",
        "npm run test:dnd-kit",
        "npm run integrations:check",
        "npm run test:integrations",
        "npm run test:next-server",
        "npm run test:codecs",
        "npm run bindings:next:check",
        "PostCSS to 8.5.23",
    ):
        if fragment not in documentation:
            raise SecurityToolingFailure(
                f"linked documentation lost compatibility guidance: {fragment}"
            )

    documentation_indexes = read_text(DOCS_INDEX) + "\n" + read_text(
        ROOT / "docs/architecture.md"
    )
    for relative_path in (
        "configuration.md",
        "binding-policy.md",
        "codecs.md",
        "environment-boundaries.md",
        "client-components.md",
        "react-hooks.md",
        "server-functions.md",
        "cache-components.md",
        "adr/0003-boundary-classification-and-import-graph-enforcement.md",
        "adr/0004-haxe-native-react-component-authoring.md",
        "adr/0006-haxe-native-react-hook-authoring.md",
        "pages-and-layouts.md",
        "route-queries.md",
        "metadata-and-segment-config.md",
        "special-files.md",
        "proxy.md",
        "generated-output-ownership.md",
        "generated-output-publication.md",
        "cli.md",
        "testing-strategy.md",
        "showcases.md",
    ):
        if relative_path not in documentation_indexes:
            raise SecurityToolingFailure(
                f"documentation indexes lost required reference: {relative_path}"
            )
    compatibility = read_text(ROOT / "docs/compatibility.md")
    for fragment in (
        "machine-readable matrix is the source of truth",
        "Sibling repositories are optional tooling oracles",
        "npm run support:require-upstream",
        "npm run drift:next:stable",
        "npm run drift:next:upstream",
        "NEXTJSHX_NEXT_PACKAGE_DIR",
        "never rewrite the checked stable baseline",
    ):
        if fragment not in compatibility:
            raise SecurityToolingFailure(
                f"compatibility documentation lost required statement: {fragment}"
            )
    testing = read_text(ROOT / "docs/testing-strategy.md")
    for fragment in (
        "npm run test:architecture",
        "npm run test:haxe:positive",
        "npm run test:haxe:negative",
        "npm run test:adapter-plan",
        "npm run test:routes",
        "npm run test:page-layouts",
        "npm run test:metadata-segment",
        "npm run test:route-handlers",
        "npm run test:special-files",
        "npm run test:proxy",
        "npm run test:route-hrefs",
        "npm run test:environment-boundaries",
        "npm run test:client-components",
        "npm run test:server-functions",
        "npm run test:cache-boundaries",
        "npm run test:config-discovery",
        "npm run test:ownership-preflight",
        "npm run test:publication",
        "npm run test:cli",
        "npm run test:dev",
        "npm run test:snapshots:update",
        "npm run test:package-shape",
        "npm run test:compiler-gaps",
        "npm run test:next-surface",
        "npm run test:next-bindings",
        "npm run test:next-drift",
        "npm run drift:next:stable",
        "npm run drift:next:upstream",
        "NEXTJSHX_NEXT_PACKAGE_DIR",
        "npm run test:next-core-navigation",
        "npm run test:next-components",
        "npm run test:showcase-ui",
        "npm run integrations:check",
        "npm run test:integrations",
        "npm run test:next-server",
        "npm run test:codecs",
        "npm run test:example:todoapp",
        "npm run test:example:todoapp:e2e",
        "npm run test:showcases",
        "fullyParallel: false",
        "zero retries",
        "todoapp-production-e2e",
        "skipLibCheck: false",
        "lifecycle scripts disabled",
    ):
        if fragment not in testing:
            raise SecurityToolingFailure(
                f"testing strategy lost required statement: {fragment}"
            )

    showcases = read_text(SHOWCASE_DOC)
    for fragment in (
        "Haxe, TSX, and shadcn ownership",
        "npm run test:showcases:source",
        "npm run test:showcase-ui",
        "npm run test:showcases",
        "compiles each site twice",
        "Spread attribute missing expression",
        "Source-owned shadcn Button",
        "Responsive production-browser proof",
        "nextjs.components.NextLink",
        "only the adapter files named by the validated ownership",
    ):
        if fragment not in showcases:
            raise SecurityToolingFailure(
                f"showcase documentation lost required evidence: {fragment}"
            )

    for showcase_root in (SHOWCASE_UI_ROOT, *SHOWCASE_APP_ROOTS):
        showcase_readme = read_text(showcase_root / "README.md")
        if "showcase" not in showcase_readme.lower():
            raise SecurityToolingFailure(
                f"{showcase_root.name} README lost its showcase purpose"
            )

    metadata_segment = read_text(ROOT / "docs/metadata-and-segment-config.md")
    for fragment in (
        "Why this layer was needed",
        "Positive: generated metadata and static params",
        "Negative examples",
        "SegmentConfig.create",
        "Next 16.2.12",
        "npm run test:metadata-segment",
    ):
        if fragment not in metadata_segment:
            raise SecurityToolingFailure(
                f"metadata/config documentation lost required statement: {fragment}"
            )

    codecs = read_text(ROOT / "docs/codecs.md")
    for fragment in (
        "Why this layer was needed",
        "Positive: decode once into a domain value",
        "Negative: unchecked input and non-JSON output fail",
        "RequestDecoder.json",
        "InvalidFormData",
        "ResponseJson.invalid",
        "FormDataDecoder.serverAction",
        "$ACTION_*",
        "npm run test:codecs",
    ):
        if fragment not in codecs:
            raise SecurityToolingFailure(
                f"codec documentation lost required statement: {fragment}"
            )

    route_queries = read_text(ROOT / "docs/route-queries.md")
    for fragment in (
        "Why this layer exists",
        "Positive example",
        "Negative controls",
        "@:next.query(QueryType)",
        "URLSearchParams",
        "npm run test:route-hrefs",
        "Incoming page `SearchParams` remain untrusted raw URL input",
    ):
        if fragment not in route_queries:
            raise SecurityToolingFailure(
                f"typed-query documentation lost required statement: {fragment}"
            )

    environment_boundaries = read_text(ROOT / "docs/environment-boundaries.md")
    for fragment in (
        "Why this layer was needed",
        "Positive: named server environment access",
        "Negative: a Client Component reaches server-only code",
        "@:next.serverOnly",
        "@:next.clientOnly",
        "ServerEnvironment.get",
        "NXHX-BOUNDARY-REQUEST-0003",
        "npm run test:environment-boundaries",
        "Next remains the final graph oracle",
    ):
        if fragment not in environment_boundaries:
            raise SecurityToolingFailure(
                "environment-boundary documentation lost required statement: "
                + fragment
            )

    client_components = read_text(ROOT / "docs/client-components.md")
    for fragment in (
        "Why this layer was needed",
        "Positive: render a typed Client Component boundary",
        "Negative: importing the raw implementation",
        "Typed Hook identity and custom Hook composition",
        "React `use` is not a Hook",
        "Locally sound render-purity checks",
        "@:next.clientComponent",
        "@:next.hook",
        "CachedPromise",
        "NXHX-REACT-HOOK-0002",
        "NXHX-REACT-USE-0003",
        "NXHX-REACT-PURITY-0004",
        "eslint-plugin-react-hooks",
        "ClientComponent.ref",
        "NXHX-SERIALIZABLE-PROP-0001",
        "Next remains the final graph oracle",
        "npm run test:client-components",
    ):
        if fragment not in client_components:
            raise SecurityToolingFailure(
                "client-component documentation lost required statement: "
                + fragment
            )

    react_hooks = read_text(ROOT / "docs/react-hooks.md")
    for fragment in (
        "Semantic state: the normal Haxe API",
        "Lazy and function-valued state",
        "Explicit memo dependencies",
        "Faithful raw state and tuple projection",
        "Author and export a Haxe Hook",
        "Consume TypeScript, JavaScript, and existing Next modules from Haxe",
        '@:ts.type("[$0, $1]")',
        "@:next.exportHook",
        "genes.react",
        "GTS-REACT-STATE-001",
        "GTS-REACT-DEPS-001",
        "GTS-REACT-DEPS-002",
        "NXHX-REACT-EXPORT-0002",
        "Haxe is the primary typechecker",
        "npm run test:client-components",
    ):
        if fragment not in react_hooks:
            raise SecurityToolingFailure(
                "React Hook documentation lost required statement: " + fragment
            )

    server_functions = read_text(ROOT / "docs/server-functions.md")
    for fragment in (
        "Why this layer was needed",
        "Positive: a native form action",
        "Negative: a synchronous or raw action edge",
        "@:next.serverFunctions",
        "@:next.action",
        "ServerFunction.ref",
        "FormDataDecoder.serverAction",
        "$ACTION_*",
        "public HTTP endpoint",
        "authenticate",
        "authorize",
        "no custom RPC protocol",
        "npm run test:server-functions",
    ):
        if fragment not in server_functions:
            raise SecurityToolingFailure(
                "Server Function documentation lost required statement: "
                + fragment
            )

    cache_components = read_text(ROOT / "docs/cache-components.md")
    for fragment in (
        "This layer was needed",
        "Reusable cached function",
        "Keep request data outside shared and remote scopes",
        "CacheFunction.ref",
        "NXHX-CACHE-REQUEST-0006",
        "NXHX-CACHE-SERIALIZABLE-0005",
        "NXHX-SEGMENT-CACHE-COMPONENTS-0002",
        "nextjshx.cache-components",
        'experimentalCacheDirectives": ["private", "remote"]',
        "There is no NextJsHx cache runtime",
        "authentication, authorization, tenant isolation",
        "strict Next production build remains blocking",
        "npm run test:cache-boundaries",
    ):
        if fragment not in cache_components:
            raise SecurityToolingFailure(
                "Cache Components documentation lost required statement: "
                + fragment
            )

    todo_readme = read_text(TODO_APP_README)
    for fragment in (
        "Why Haxe is useful here",
        "Architecture",
        "Suggested reading order",
        "Gotchas",
        "Evidence",
        ".nextjshx/manifest.json",
        "src-gen/",
        "npm run test:example:todoapp",
        "`@:next.action`",
        "Next Cache Components",
        "revalidateTag",
        "updateTag",
        "authenticate",
        "authorize",
    ):
        if fragment not in todo_readme:
            raise SecurityToolingFailure(
                f"todo app documentation lost required evidence: {fragment}"
            )

    todo_flagship = read_text(TODO_FLAGSHIP_DOC)
    for fragment in (
        "Architecture and ownership",
        "Where Haxe improves the authoring surface",
        "TypeScript and JavaScript ecosystem interop",
        "Evidence matrix",
        "Honest limitations",
        "fourteen isolated, one-worker, zero-retry Playwright production journeys",
        "537,191 raw bytes",
        "nxhx-0dg",
        "npm run public:preflight",
    ):
        if fragment not in todo_flagship:
            raise SecurityToolingFailure(
                f"todo flagship documentation lost required evidence: {fragment}"
            )

    binding_policy = read_text(ROOT / "docs/binding-policy.md")
    for fragment in (
        "config/next-public-entrypoints.json",
        "surface/next-public-surface.json",
        "next/experimental/*",
        "compatibilityPromise: false",
        "runtimeImportAllowed: false",
        "npm run surface:next:check",
        "npm run surface:next:update",
        "npm run bindings:next:check",
        "npm run bindings:next:update",
        "npm run drift:next:stable",
        "npm run drift:next:upstream",
        "NEXTJSHX_NEXT_PACKAGE_DIR",
        "NXHX-DRIFT-DECLARATION-MOVED",
        "default Image component signatures",
        "surface/next-binding-ir.json",
        "config/next-binding-overrides.json",
        "config/next-binding-implementations.json",
        "acceptedTransitions",
        "unsupported construct",
        "Generated-binding negative",
        "update command is disabled in CI",
        "Without this allowlist",
        "nextjs.components.NextLink",
        "JSX-safe semantic component values",
    ):
        if fragment not in binding_policy:
            raise SecurityToolingFailure(
                f"binding policy lost required statement: {fragment}"
            )

    cli = read_text(ROOT / "docs/cli.md")
    for fragment in (
        "nextjshx generate [--json] [--no-check]",
        "nextjshx typecheck [--json]",
        "nextjshx routes [--json] [--check]",
        "explicit `haxe` or `native` origin",
        "does not follow symlinks",
        "temporary `Route<literal>` assignments",
        "CLI does not edit",
        "or parse `.next/types` as a stable API",
        "nextjshx doctor [--json]",
        "nextjshx build [--json]",
        "create`, `update`, `unchanged`, or `remove",
        "without the transaction boundary",
        "false green result",
        "491f78099c3ea23be14e66c6d848b50204590e90",
        "--experimental-upload-trace",
        "NXHX-CLI-BUILD-0009",
        '"ok": false',
    ):
        if fragment not in cli:
            raise SecurityToolingFailure(
                f"CLI documentation lost required contract: {fragment}"
            )

    compiler_gaps = read_text(ROOT / "docs/compiler-gap-inventory.md")
    for fragment in (
        "GENES-GAP-DIR-001",
        "GENES-GAP-DCE-001",
        "GENES-GAP-EXP-001",
        "GENES-CAP-JSX-001",
        EXPECTED_GENES_COMMIT,
        "nxhx-f34.2.2",
        "nxhx-f34.2.3",
        "nxhx-f34.2.4",
    ):
        if fragment not in compiler_gaps:
            raise SecurityToolingFailure(
                f"compiler-gap inventory lost required evidence: {fragment}"
            )

    for relative in (
        ".beads/hooks/pre-commit",
        ".beads/hooks/pre-push",
        "scripts/hooks/install.sh",
        "scripts/hooks/pre-commit",
        "scripts/hooks/pre-push",
        "scripts/beads/push-safe.sh",
        "scripts/ci/check_architecture_docs.py",
        "scripts/ci/install-gitleaks.sh",
        "scripts/ci/install-beads.sh",
        "scripts/compat/support-matrix.mjs",
        "scripts/bindings/next-surface.mjs",
        "scripts/bindings/sync-next-bindings.mjs",
        "scripts/bindings/next-compatibility.mjs",
        "scripts/fixtures/next-stable.mjs",
        "scripts/examples/todoapp-next.mjs",
        "scripts/examples/showcases.mjs",
        "scripts/testing/compiler-gaps.mjs",
        "scripts/testing/test-lanes.mjs",
        "tools/cli/scripts/ensure-build.mjs",
        "scripts/testing/haxe-fixtures.mjs",
        "scripts/testing/package-shape.mjs",
        "scripts/testing/next-surface.mjs",
        "scripts/testing/next-bindings.mjs",
        "scripts/testing/next-drift.mjs",
        "scripts/testing/next-core-navigation.mjs",
        "scripts/testing/next-components.mjs",
        "scripts/testing/showcase-ui.mjs",
        "scripts/testing/next-server.mjs",
        "scripts/testing/codecs.mjs",
        "scripts/testing/environment-boundaries.mjs",
        "scripts/testing/clientification-boundaries.mjs",
        "scripts/testing/client-components.mjs",
        "scripts/testing/server-functions.mjs",
        "scripts/testing/cache-boundaries.mjs",
        "scripts/testing/metadata-segment.mjs",
        "scripts/testing/page-layouts.mjs",
        "scripts/testing/route-handlers.mjs",
        "scripts/testing/special-files.mjs",
        "scripts/testing/proxy.mjs",
        "scripts/testing/snapshots.mjs",
        "scripts/lint/hx_format_guard.sh",
        "scripts/lint/local_path_guard_staged.sh",
        "scripts/lint/whitespace_guard.sh",
        "scripts/security/run-beads-gitleaks.sh",
        "scripts/security/run-gitleaks.sh",
    ):
        require_executable(relative)


def main() -> int:
    try:
        version, digest = validate_installer()
        validate_beads_installer()
        action_count = validate_workflows()
        validate_gitleaks_config()
        validate_hook_wiring()
        scanned_files = validate_ignores_and_tracked_files()
        validate_package_contract()
        validate_haxe_locks()
        validate_test_harness()
        validate_docs_and_modes()
        print(
            "security-tooling: OK: "
            f"Gitleaks {version} ({digest}), {action_count} commit-pinned Action uses, "
            f"{scanned_files} tracked text files checked for path leaks, "
            f"formatter {EXPECTED_FORMATTER_VERSION}, Git/Dolt/decoded-Beads gates, "
            "credential ignores, exact stable-fixture pins, fail-closed test harness, "
            "dependency audit wiring, and disclosure policy"
        )
        return 0
    except (
        OSError,
        UnicodeError,
        subprocess.CalledProcessError,
        subprocess.TimeoutExpired,
        SecurityToolingFailure,
    ) as error:
        print(f"security-tooling: ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
