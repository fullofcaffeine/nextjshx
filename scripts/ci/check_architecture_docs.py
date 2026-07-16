#!/usr/bin/env python3
"""Validate that normative architecture decisions are complete and indexed."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADR_ROOT = ROOT / "docs/adr"
ADR_INDEX = ADR_ROOT / "README.md"
ARCHITECTURE = ROOT / "docs/architecture.md"
README = ROOT / "README.md"
CONTRIBUTING = ROOT / "CONTRIBUTING.md"
ADAPTER_ADR = ADR_ROOT / "0001-adapter-first-app-router-integration.md"
ADR_NAME = re.compile(r"^(?P<number>[0-9]{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


class ArchitectureFailure(RuntimeError):
    pass


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        try:
            label = path.relative_to(ROOT)
        except ValueError:
            label = path
        raise ArchitectureFailure(f"cannot read {label}: {error}") from error


def metadata(source: str, name: str, path: Path) -> str:
    match = re.search(rf"^- {re.escape(name)}: (.+)$", source, re.MULTILINE)
    if match is None:
        raise ArchitectureFailure(f"{path.name} is missing {name} metadata")
    return match.group(1).strip()


def require_fragments(source: str, path: Path, fragments: tuple[str, ...]) -> None:
    for fragment in fragments:
        if fragment not in source:
            raise ArchitectureFailure(f"{path.name} is missing: {fragment}")


def adr_files() -> list[Path]:
    try:
        children = list(ADR_ROOT.iterdir())
    except OSError as error:
        raise ArchitectureFailure(f"cannot list docs/adr: {error}") from error
    return sorted(
        (
            path
            for path in children
            if path.is_file() and path.name != "README.md"
        ),
        key=lambda path: path.name.encode("utf-8"),
    )


def validate_adr(path: Path, index: str, architecture: str) -> str:
    match = ADR_NAME.fullmatch(path.name)
    if match is None:
        raise ArchitectureFailure(f"invalid ADR filename: {path.name}")
    number = match.group("number")
    source = read_text(path)
    if not source.startswith(f"# ADR {number}: "):
        raise ArchitectureFailure(f"{path.name} header must match its stable number")

    status = metadata(source, "Status", path)
    if status not in {"Proposed", "Accepted", "Superseded", "Rejected"}:
        raise ArchitectureFailure(f"{path.name} has unsupported status: {status}")
    if DATE.fullmatch(metadata(source, "Date", path)) is None:
        raise ArchitectureFailure(f"{path.name} has an invalid ISO date")
    for field in ("Decision owners", "Related Beads", "Related PRD sections"):
        if metadata(source, field, path) == "":
            raise ArchitectureFailure(f"{path.name} has empty {field} metadata")

    require_fragments(
        source,
        path,
        (
            "\n## Context\n",
            "\n## Decision\n",
            "\n## Consequences\n",
            "\n## Rejected alternatives\n",
        ),
    )
    if re.search(r"\b(?:TODO|TBD)\b", source) is not None:
        raise ArchitectureFailure(
            f"{path.name} contains TODO/TBD text; track unresolved work in Beads"
        )

    if status == "Accepted":
        link = f"({path.name})"
        architecture_link = f"(adr/{path.name})"
        if link not in index:
            raise ArchitectureFailure(f"accepted {path.name} is absent from ADR index")
        if architecture_link not in architecture:
            raise ArchitectureFailure(
                f"accepted {path.name} is absent from docs/architecture.md"
            )
    return status


def validate_adapter_decision() -> None:
    source = read_text(ADAPTER_ADR)
    require_fragments(
        source,
        ADAPTER_ADR,
        (
            "### Adapter-first generation is canonical",
            "### Files NextJsHx never owns implicitly",
            "### Direct-emission admission criteria",
            "### Generic direct compiler emission as the initial integration",
            "### A custom runtime or router",
            "### Hand-maintained adapters",
            "next typegen",
            "strict TypeScript",
            "next build",
            "nxhx-f34.1.3",
        ),
    )


def main() -> int:
    try:
        architecture = read_text(ARCHITECTURE)
        index = read_text(ADR_INDEX)
        readme = read_text(README)
        contributing = read_text(CONTRIBUTING)
        require_fragments(
            architecture,
            ARCHITECTURE,
            (
                "architecture decision records",
                "directory is never treated as wholly owned",
                "Live architecture work remains in Beads",
            ),
        )
        if "(docs/architecture.md)" not in readme:
            raise ArchitectureFailure("README.md does not link docs/architecture.md")
        if "(docs/architecture.md)" not in contributing:
            raise ArchitectureFailure(
                "CONTRIBUTING.md does not link docs/architecture.md"
            )

        files = adr_files()
        if not files:
            raise ArchitectureFailure("docs/adr contains no decision records")
        accepted = sum(
            validate_adr(path, index, architecture) == "Accepted" for path in files
        )
        validate_adapter_decision()
        noun = "ADR" if len(files) == 1 else "ADRs"
        print(
            f"architecture-docs: OK: {len(files)} {noun} checked, "
            f"{accepted} accepted and indexed"
        )
        return 0
    except ArchitectureFailure as error:
        print(f"architecture-docs: ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
