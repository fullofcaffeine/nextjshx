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
AUTHORING_ADR = ADR_ROOT / "0002-public-namespace-and-app-router-authoring.md"
BOUNDARY_ADR = ADR_ROOT / "0003-boundary-classification-and-import-graph-enforcement.md"
COMPONENT_ADR = ADR_ROOT / "0004-haxe-native-react-component-authoring.md"
SECURITY_ADR = ADR_ROOT / "0005-server-function-security-ergonomics.md"
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


def validate_authoring_decision() -> None:
    source = read_text(AUTHORING_ADR)
    require_fragments(
        source,
        AUTHORING_ADR,
        (
            "### Namespace split",
            "`nextjs.raw.*`",
            "`nextjs._internal.*`",
            "`nextjshx.*`",
            "### Per-type App Router declarations",
            '@:next.page("todos/[id]")',
            '@:next.layout("")',
            '@:next.loading("todos")',
            '@:next.error("todos")',
            '@:next.notFound("todos")',
            '@:next.route("api/todos/[id]")',
            '@:next.clientComponent("todos/_components/TodoToggle")',
            '@:next.serverFunctions("todos/actions")',
            "ClientComponent.ref(TodoToggle)",
            "ServerFunction.ref(TodoActions.createTodo)",
            "### Faithful raw escape hatch",
            "### No manually maintained route registry",
            "### Loading, error, and not-found amendment",
            "### Explicitly deferred syntax",
            "### Raw externs only",
            "### Semantic wrappers only",
            "### Central manually maintained route registry",
            "nxhx-f34.1.4",
        ),
    )


def validate_boundary_decision() -> None:
    source = read_text(BOUNDARY_ADR)
    require_fragments(
        source,
        BOUNDARY_ADR,
        (
            "### Classification model",
            "Server default",
            "Client boundary",
            "Server Function module",
            "Shared pure",
            "Explicit server-only",
            "Explicit client-only",
            "Cache boundary",
            "### One Haxe module, one boundary",
            "### Import and reference policy",
            "ClientComponent.ref(TodoToggle)",
            "ServerFunction.ref(TodoActions.toggle)",
            "### Directive and side-effect ownership",
            '@:genes.moduleDirective("literal")',
            'Imports.sideEffect("server-only")',
            "### DCE and external adapter callers",
            "### Enforcement ownership",
            "### Cache interaction",
            "### Environment and security boundary",
            "### Rely only on Next build diagnostics",
            "### Enforce the complete graph exclusively in Haxe",
            "### Add a custom client/server runtime or RPC envelope",
            "nxhx-f34.5.1",
        ),
    )


def validate_component_decision() -> None:
    source = read_text(COMPONENT_ADR)
    require_fragments(
        source,
        COMPONENT_ADR,
        (
            "### Component categories follow usage, not inheritance",
            "### Compared authoring and emission shapes",
            "### Server Components remain the zero-ceremony default",
            "### Client entry declarations infer their adapter",
            "TideDial.client()",
            "using nextjs.client.ClientComponent;",
            "_nextjshx/client/6846cd673a8e/TideDial.tsx",
            "### Children and named slots are ReactNode composition",
            "### Async Server Components use native Promise and Suspense semantics",
            "### Third-party client libraries use a narrow Haxe-owned leaf",
            "### Native TypeScript interop remains bidirectional",
            "### Compatibility and migration",
            "### Enforcement and evidence split",
            "### Add nominal ServerComponent and ClientComponent base classes",
            "### Emit the client boundary directly from genes-ts",
            "### Generate a custom component, serialization, or HMR runtime",
            "nxhx-f34.5.8.1",
        ),
    )


def validate_security_decision() -> None:
    source = read_text(SECURITY_ADR)
    require_fragments(
        source,
        SECURITY_ADR,
        (
            "### Native Next and React protections remain in force",
            "serverActions.allowedOrigins",
            "serverActions.bodySizeLimit",
            "Direct POST reachability",
            "### Mechanically provable and application-owned facts",
            "### Use an explicitly guarded semantic path",
            "GuardedAction.run(spec)",
            "### The witness is scoped and cannot be self-asserted",
            "Authorized<Operation, Actor, Target, Input>",
            "### Authentication is request-local and server-derived",
            "useActionState",
            "### Resolution is authenticated and target-specific",
            "### Projection is mandatory but does not certify secrecy",
            "### Example one: create inside an authorized workspace",
            "### Example two: toggle the exact current todo",
            "### Static analysis is deliberately bounded",
            "### Evidence required by the implementation",
            "### Add authority-sounding action metadata",
            "### Statically recognize authentication and authorization calls",
            "### Reimplement Server Functions behind a custom RPC or policy runtime",
            "nxhx-f34.5.8.4",
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
        if (
            "(docs/adr/0003-boundary-classification-and-import-graph-enforcement.md)"
            not in readme
        ):
            raise ArchitectureFailure("README.md does not link boundary ADR 0003")

        files = adr_files()
        if not files:
            raise ArchitectureFailure("docs/adr contains no decision records")
        accepted = sum(
            validate_adr(path, index, architecture) == "Accepted" for path in files
        )
        validate_adapter_decision()
        validate_authoring_decision()
        validate_boundary_decision()
        validate_component_decision()
        validate_security_decision()
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
