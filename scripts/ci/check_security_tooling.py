#!/usr/bin/env python3
"""Fail closed when leak-prevention or CI supply-chain policy drifts."""

from __future__ import annotations

import fnmatch
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
GITLEAKS_CONFIG = ROOT / ".gitleaks.toml"
PACKAGE = ROOT / "package.json"
PACKAGE_LOCK = ROOT / "package-lock.json"
HAXERC = ROOT / ".haxerc"
EXPECTED_ACTIONS = {
    "actions/checkout": "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
    "actions/setup-node": "249970729cb0ef3589644e2896645e5dc5ba9c38",
}
EXPECTED_GITLEAKS_VERSION = "8.30.0"
EXPECTED_FORMATTER_VERSION = "1.18.0"
EXPECTED_HAXE_VERSION = "4.3.7"
EXPECTED_LIX_VERSION = "17.0.2"
EXPECTED_AJV_VERSION = "8.20.0"
PUBLIC_PREFLIGHT_COMMAND = (
    "npm run format:haxe:check && npm run lint:whitespace && "
    "npm run security:gitleaks && npm run security:beads-history && "
    "npm run security:audit && npm test"
)
REQUIRED_IGNORES = {
    "node_modules/",
    ".next/",
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
        "  secret-scan:\n",
        "  haxe-format:\n",
        "  compatibility-contract:\n",
        "  security-tooling:\n",
        "fetch-depth: 0",
        "bash scripts/ci/install-gitleaks.sh --install-dir",
        "bash scripts/security/run-gitleaks.sh",
        "npx --no-install lix download",
        f"npx --no-install haxelib install formatter {EXPECTED_FORMATTER_VERSION} --quiet",
        "npm run security:audit",
        "npm run test:support-matrix",
        "npm run test:security-tooling",
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
        "only partially staged",
        "scripts/lint/local_path_guard_staged.sh",
        'scripts/lint/whitespace_guard.sh" --staged',
        'scripts/security/run-gitleaks.sh" --staged',
        "scripts/compat/support-matrix.mjs",
        "(issues|interactions)\\.jsonl",
        "scripts/ci/check_security_tooling.py",
    ):
        if fragment not in pre_commit:
            raise SecurityToolingFailure(f"pre-commit lost required behavior: {fragment}")

    pre_push = read_text(ROOT / "scripts/hooks/pre-push")
    for fragment in (
        'scripts/security/run-gitleaks.sh"',
        'scripts/security/run-beads-gitleaks.sh"',
        "scripts/ci/check_security_tooling.py",
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
        if source.index(repository_hook) > source.index(managed_marker):
            raise SecurityToolingFailure(
                f"repository {hook_name} checks must run before the Beads-managed section"
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
        "export --all",
        'history "$issue_id" --json',
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
        'dolt push "$@"',
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
        "security:audit": "npm audit --audit-level=high",
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
        "test:support-matrix": "node scripts/compat/support-matrix.mjs check",
        "test:security-tooling": "python3 scripts/ci/check_security_tooling.py",
        "test": (
            "npm run test:plan && npm run test:support-matrix && "
            "npm run test:security-tooling"
        ),
        "public:preflight": PUBLIC_PREFLIGHT_COMMAND,
    }
    for name, command in expected_scripts.items():
        if scripts.get(name) != command:
            raise SecurityToolingFailure(f"package.json lost {name}: {command}")
    if package.get("engines") != {"node": ">=20.9.0"}:
        raise SecurityToolingFailure("package.json must retain the Next.js Node floor")
    expected_dev_dependencies = {
        "ajv": EXPECTED_AJV_VERSION,
        "lix": EXPECTED_LIX_VERSION,
    }
    if package.get("devDependencies") != expected_dev_dependencies:
        raise SecurityToolingFailure(
            "package.json must pin the reviewed Ajv and Lix versions"
        )

    package_lock = read_json(PACKAGE_LOCK)
    packages = package_lock.get("packages")
    if not isinstance(packages, dict):
        raise SecurityToolingFailure("package-lock.json has no packages map")
    root_lock = packages.get("")
    ajv_lock = packages.get("node_modules/ajv")
    lix_lock = packages.get("node_modules/lix")
    if (
        not isinstance(root_lock, dict)
        or root_lock.get("devDependencies") != expected_dev_dependencies
    ):
        raise SecurityToolingFailure("package-lock root drifted from reviewed pins")
    if not isinstance(ajv_lock, dict) or ajv_lock.get("version") != EXPECTED_AJV_VERSION:
        raise SecurityToolingFailure("package-lock did not resolve the exact Ajv version")
    if not isinstance(lix_lock, dict) or lix_lock.get("version") != EXPECTED_LIX_VERSION:
        raise SecurityToolingFailure("package-lock did not resolve the exact Lix version")

    haxerc = read_json(HAXERC)
    if haxerc != {"version": EXPECTED_HAXE_VERSION, "resolveLibs": "scoped"}:
        raise SecurityToolingFailure("the Haxe toolchain contract drifted")


def validate_docs_and_modes() -> None:
    security = read_text(ROOT / "SECURITY.md")
    for fragment in (
        "boss@fullofcaffeine.com",
        "There is no published or supported release",
        "must be enabled and verified",
        "npm run public:preflight",
        "npm run beads:push",
    ):
        if fragment not in security:
            raise SecurityToolingFailure(f"SECURITY.md lost required statement: {fragment}")
    read_text(ROOT / "CONTRIBUTING.md")
    readme = read_text(ROOT / "README.md")
    for fragment in (
        "support_matrix.json",
        "npm run test:support-matrix",
        "npm run support:discover",
    ):
        if fragment not in readme:
            raise SecurityToolingFailure(f"README.md lost compatibility guidance: {fragment}")
    compatibility = read_text(ROOT / "docs/compatibility.md")
    for fragment in (
        "machine-readable matrix is the source of truth",
        "Sibling repositories are optional tooling oracles",
        "npm run support:require-upstream",
    ):
        if fragment not in compatibility:
            raise SecurityToolingFailure(
                f"compatibility documentation lost required statement: {fragment}"
            )

    for relative in (
        ".beads/hooks/pre-commit",
        ".beads/hooks/pre-push",
        "scripts/hooks/install.sh",
        "scripts/hooks/pre-commit",
        "scripts/hooks/pre-push",
        "scripts/beads/push-safe.sh",
        "scripts/ci/install-gitleaks.sh",
        "scripts/compat/support-matrix.mjs",
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
        action_count = validate_workflows()
        validate_gitleaks_config()
        validate_hook_wiring()
        scanned_files = validate_ignores_and_tracked_files()
        validate_package_contract()
        validate_docs_and_modes()
        print(
            "security-tooling: OK: "
            f"Gitleaks {version} ({digest}), {action_count} commit-pinned Action uses, "
            f"{scanned_files} tracked text files checked for path leaks, "
            f"formatter {EXPECTED_FORMATTER_VERSION}, Git/Dolt/decoded-Beads gates, "
            "credential ignores, dependency audit wiring, and disclosure policy"
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
