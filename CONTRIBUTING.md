# Contributing to NextJsHx

NextJsHx is in foundation work and has no supported release yet. Read
[AGENTS.md](AGENTS.md), the active Beads issue, and the relevant PRD sections
before changing architecture, compiler behavior, generated ownership, or public
API.

Security vulnerabilities follow the private process in
[SECURITY.md](SECURITY.md). Never put vulnerability details, live credentials,
private data, or exploit payloads in a GitHub issue, pull request, CI log,
generated artifact, or Beads record.

## Bootstrap

Install the locked development dependency and the exact local safeguards:

```sh
npm ci
haxelib install formatter 1.18.0
npm run hooks:install
bd prime
```

The hook installer is idempotent and keeps `core.hooksPath` on
`.beads/hooks`, where the tracked repository checks run before the
Beads-managed hook section.

## Work through Beads

The PRD records product intent; Beads records live ownership and execution
state. `.beads/issues.jsonl` is a passive export, not the synchronization
protocol.

```sh
bd ready
bd show <id>
bd update <id> --claim
```

Keep work inside the issue outcome and acceptance criteria. Record discovered
follow-up with `bd create` instead of widening scope or leaving a Markdown TODO.
Do not hand-edit the Dolt database, use `bd import` for routine sync, or publish
issue data with a raw `bd dolt push`.

## Typed, framework-native changes

- Keep the result an ordinary Next.js application.
- Use `nextjs.raw.*` for faithful public bindings and `nextjs.*` for justified
  typed ergonomics.
- Do not use `Dynamic`, `Any`, `untyped`, broad `unknown`, reflection, or
  unchecked casts as a design shortcut.
- Reduce generic compiler gaps outside Next.js and fix them in `genes-ts` with
  both TypeScript and classic-JavaScript evidence.
- Generate only deterministic, manifest-owned files and fail closed on native
  file collisions.
- Treat sibling repositories as read-only references unless explicitly
  authorized.

## Before closing work

Run the issue-owned tests and the root gates:

```sh
npm test
npm run format:haxe:check
npm run public:preflight
```

Pre-commit formats and re-stages only fully staged repository-owned Haxe files,
rejects whitespace and machine-local absolute paths, and scans staged content.
Pre-push scans every reachable Git revision and decoded Beads history.

Before publishing Beads data, use:

```sh
npm run beads:push
```

That wrapper scans Git history plus decoded current and historical Beads
records before invoking `bd dolt push`.
