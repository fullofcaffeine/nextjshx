#!/usr/bin/env python3
"""Seed the NextJsHx Beads backlog from nextjshx-beads-seed.json.

This is a one-time bootstrap helper. Beads becomes the source of truth after
creation. The script deliberately does not initialize Beads, commit Git
changes, or push Git/Dolt remotes.

Typical use from the future nextjshx repository:

    bd init --prefix nxhx
    bd setup codex --check
    bd prime
    python path/to/nextjshx-seed-beads.py \
      --seed path/to/nextjshx-beads-seed.json

Use --dry-run first to inspect all commands. In a sandboxed Codex environment,
pass --sandbox so every invocation is prefixed with `bd --sandbox`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
from collections import deque
from pathlib import Path
from typing import Any, Iterable

SUPPORTED_TYPES = {"bug", "feature", "task", "epic", "chore", "decision"}


class SeedError(RuntimeError):
    """Raised when the seed or Beads operation is unsafe or invalid."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    default_seed = Path(__file__).with_name("nextjshx-beads-seed.json")
    parser.add_argument(
        "--seed",
        type=Path,
        default=default_seed,
        help=f"Seed JSON path (default: {default_seed})",
    )
    parser.add_argument(
        "--map-file",
        type=Path,
        default=Path(".beads/nextjshx-seed-import.json"),
        help="Resume/import log containing planning-alias to Beads-ID mappings",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print commands without invoking bd or writing a map",
    )
    parser.add_argument(
        "--sandbox",
        action="store_true",
        help="Invoke `bd --sandbox ...` for restricted agent environments",
    )
    parser.add_argument(
        "--skip-postflight",
        action="store_true",
        help="Skip bd graph/lint/ready verification after seeding",
    )
    return parser.parse_args()


def canonical_digest(path: Path) -> str:
    parsed = json.loads(path.read_text(encoding="utf-8"))
    canonical = json.dumps(parsed, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def load_seed(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise SeedError(f"Seed file does not exist: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SeedError(f"Could not read valid seed JSON from {path}: {exc}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("issues"), list):
        raise SeedError("Seed must be an object with an issues array")
    return data


def validate_seed(data: dict[str, Any]) -> list[dict[str, Any]]:
    issues = data["issues"]
    by_key: dict[str, dict[str, Any]] = {}
    for index, issue in enumerate(issues):
        if not isinstance(issue, dict):
            raise SeedError(f"Issue #{index + 1} is not an object")
        key = issue.get("key")
        if not isinstance(key, str) or not key:
            raise SeedError(f"Issue #{index + 1} has no non-empty key")
        if key in by_key:
            raise SeedError(f"Duplicate planning alias: {key}")
        by_key[key] = issue

        title = issue.get("title")
        if not isinstance(title, str) or not title.strip():
            raise SeedError(f"{key}: title must be non-empty")
        issue_type = issue.get("type")
        if issue_type not in SUPPORTED_TYPES:
            raise SeedError(
                f"{key}: unsupported built-in type {issue_type!r}; "
                f"expected one of {sorted(SUPPORTED_TYPES)}"
            )
        priority = issue.get("priority")
        if not isinstance(priority, int) or priority not in range(5):
            raise SeedError(f"{key}: priority must be an integer from 0 through 4")
        if not isinstance(issue.get("description"), str) or not issue["description"].strip():
            raise SeedError(f"{key}: description must be non-empty")
        criteria = issue.get("acceptanceCriteria")
        if not isinstance(criteria, list) or not criteria or not all(
            isinstance(item, str) and item.strip() for item in criteria
        ):
            raise SeedError(f"{key}: acceptanceCriteria must be a non-empty string array")
        labels = issue.get("labels", [])
        if not isinstance(labels, list) or not all(isinstance(label, str) for label in labels):
            raise SeedError(f"{key}: labels must be a string array")
        deps = issue.get("dependsOn", [])
        if not isinstance(deps, list) or not all(isinstance(dep, str) for dep in deps):
            raise SeedError(f"{key}: dependsOn must be a string array")

    # References and parent ordering.
    position = {issue["key"]: index for index, issue in enumerate(issues)}
    for issue in issues:
        key = issue["key"]
        parent = issue.get("parent")
        if parent is not None:
            if parent not in by_key:
                raise SeedError(f"{key}: unknown parent alias {parent}")
            if position[parent] >= position[key]:
                raise SeedError(f"{key}: parent {parent} must appear earlier in the seed")
        for dep in issue.get("dependsOn", []):
            if dep not in by_key:
                raise SeedError(f"{key}: unknown dependency alias {dep}")
            if dep == key:
                raise SeedError(f"{key}: issue cannot depend on itself")
            source_is_epic = issue["type"] == "epic"
            target_is_epic = by_key[dep]["type"] == "epic"
            if source_is_epic != target_is_epic:
                raise SeedError(
                    f"{key}: blocking dependency on {dep} crosses the Beads "
                    "epic/non-epic boundary; gate executable child work instead"
                )

    # Blocking dependency cycle detection.
    adjacency = {key: [] for key in by_key}
    indegree = {key: 0 for key in by_key}
    for issue in issues:
        dependent = issue["key"]
        for required in issue.get("dependsOn", []):
            adjacency[required].append(dependent)
            indegree[dependent] += 1
    queue = deque(key for key, degree in indegree.items() if degree == 0)
    visited = 0
    while queue:
        current = queue.popleft()
        visited += 1
        for dependent in adjacency[current]:
            indegree[dependent] -= 1
            if indegree[dependent] == 0:
                queue.append(dependent)
    if visited != len(by_key):
        cyclic = sorted(key for key, degree in indegree.items() if degree > 0)
        raise SeedError(f"Blocking dependency cycle detected among: {', '.join(cyclic)}")

    return issues


def shell_display(command: Iterable[str]) -> str:
    return " ".join(shlex.quote(part) for part in command)


def run(command: list[str], *, capture: bool = False, dry_run: bool = False) -> str:
    print(f"+ {shell_display(command)}")
    if dry_run:
        return ""
    completed = subprocess.run(
        command,
        check=False,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )
    if completed.returncode != 0:
        stdout = (completed.stdout or "").strip()
        stderr = (completed.stderr or "").strip()
        detail = "\n".join(part for part in (stdout, stderr) if part)
        raise SeedError(
            f"Command failed with exit code {completed.returncode}: "
            f"{shell_display(command)}" + (f"\n{detail}" if detail else "")
        )
    return (completed.stdout or "").strip()


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


def load_import_log(path: Path, seed_digest: str) -> dict[str, Any]:
    if not path.exists():
        return {
            "schema": "nextjshx-beads-import-log/v1",
            "seedSha256": seed_digest,
            "aliases": {},
            "dependencies": [],
        }
    try:
        log = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SeedError(f"Invalid import log {path}: {exc}") from exc
    if log.get("schema") != "nextjshx-beads-import-log/v1":
        raise SeedError(f"Unsupported import-log schema in {path}")
    if log.get("seedSha256") != seed_digest:
        raise SeedError(
            f"Seed digest differs from existing import log {path}. "
            "Refuse to resume across a changed plan; use a reviewed new map path."
        )
    if not isinstance(log.get("aliases"), dict) or not isinstance(log.get("dependencies"), list):
        raise SeedError(f"Malformed import log {path}")
    return log


def bd_base(sandbox: bool) -> list[str]:
    return ["bd", "--sandbox"] if sandbox else ["bd"]


def preflight(base: list[str], *, dry_run: bool) -> None:
    if dry_run:
        return
    if shutil.which("bd") is None:
        raise SeedError("bd is not on PATH; install and initialize Beads first")
    help_text = run(base + ["create", "--help"], capture=True)
    required_flags = ["--silent", "--acceptance", "--metadata", "--parent", "--labels"]
    missing = [flag for flag in required_flags if flag not in help_text]
    if missing:
        raise SeedError(
            "Installed bd create command lacks required flags: " + ", ".join(missing)
        )
    run(base + ["where"], capture=True)


def acceptance_text(criteria: list[str]) -> str:
    return "## Acceptance Criteria\n\n" + "\n".join(f"- {item}" for item in criteria)


def description_text(issue: dict[str, Any]) -> str:
    sections = ", ".join(issue.get("prdSections", [])) or "none"
    return (
        f"{issue['description'].rstrip()}\n\n"
        f"Planning alias: {issue['key']}\n"
        f"PRD sections: {sections}"
    )


def create_issues(
    issues: list[dict[str, Any]],
    base: list[str],
    log: dict[str, Any],
    map_path: Path,
    *,
    dry_run: bool,
) -> None:
    aliases: dict[str, str] = log["aliases"]
    for issue in issues:
        alias = issue["key"]
        if alias in aliases:
            print(f"= {alias} already mapped to {aliases[alias]}; skipping create")
            continue
        command = base + [
            "create",
            issue["title"],
            "--type",
            issue["type"],
            "--priority",
            str(issue["priority"]),
            "--description",
            description_text(issue),
            "--acceptance",
            acceptance_text(issue["acceptanceCriteria"]),
            "--metadata",
            json.dumps(
                {
                    "planning_alias": alias,
                    "prd_sections": issue.get("prdSections", []),
                    "seed_schema": "nextjshx-beads-seed/v1",
                },
                separators=(",", ":"),
            ),
        ]
        labels = issue.get("labels", [])
        if labels:
            command += ["--labels", ",".join(labels)]
        parent = issue.get("parent")
        if parent:
            actual_parent = aliases.get(parent)
            if not actual_parent and not dry_run:
                raise SeedError(f"{alias}: parent {parent} has not been mapped")
            command += ["--parent", actual_parent or f"<{parent}-id>"]
        command.append("--silent")

        output = run(command, capture=True, dry_run=dry_run)
        if dry_run:
            continue
        issue_id = output.splitlines()[-1].strip() if output else ""
        if not issue_id or any(char.isspace() for char in issue_id):
            raise SeedError(f"{alias}: could not parse issue ID from bd --silent output {output!r}")
        aliases[alias] = issue_id
        atomic_write_json(map_path, log)
        print(f"  mapped {alias} -> {issue_id}")


def add_dependencies(
    issues: list[dict[str, Any]],
    base: list[str],
    log: dict[str, Any],
    map_path: Path,
    *,
    dry_run: bool,
) -> None:
    aliases: dict[str, str] = log["aliases"]
    completed = set(log["dependencies"])
    for issue in issues:
        dependent_alias = issue["key"]
        for required_alias in issue.get("dependsOn", []):
            edge_key = f"{dependent_alias}<-{required_alias}"
            if edge_key in completed:
                print(f"= dependency {edge_key} already recorded; skipping")
                continue
            dependent = aliases.get(dependent_alias, f"<{dependent_alias}-id>")
            required = aliases.get(required_alias, f"<{required_alias}-id>")
            if not dry_run and (dependent_alias not in aliases or required_alias not in aliases):
                raise SeedError(f"Cannot add unmapped dependency {edge_key}")
            run(base + ["dep", "add", dependent, required], dry_run=dry_run)
            if not dry_run:
                log["dependencies"].append(edge_key)
                completed.add(edge_key)
                atomic_write_json(map_path, log)


def postflight(base: list[str], *, dry_run: bool) -> None:
    checks = [
        ["dep", "cycles"],
        ["graph", "check"],
        ["lint"],
        ["ready", "--json"],
        ["blocked", "--json"],
    ]
    for args in checks:
        run(base + args, dry_run=dry_run)


def main() -> int:
    args = parse_args()
    try:
        seed = load_seed(args.seed)
        issues = validate_seed(seed)
        digest = canonical_digest(args.seed)
        base = bd_base(args.sandbox)
        preflight(base, dry_run=args.dry_run)
        log = (
            {
                "schema": "nextjshx-beads-import-log/v1",
                "seedSha256": digest,
                "aliases": {},
                "dependencies": [],
            }
            if args.dry_run
            else load_import_log(args.map_file, digest)
        )
        create_issues(issues, base, log, args.map_file, dry_run=args.dry_run)
        add_dependencies(issues, base, log, args.map_file, dry_run=args.dry_run)
        if not args.skip_postflight:
            postflight(base, dry_run=args.dry_run)
        if args.dry_run:
            print(f"Dry run complete: {len(issues)} issues validated; no changes made.")
        else:
            print(
                f"Seed complete: {len(log['aliases'])} aliases and "
                f"{len(log['dependencies'])} blocking dependencies recorded in {args.map_file}."
            )
        return 0
    except SeedError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
