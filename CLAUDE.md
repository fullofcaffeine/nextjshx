# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm ci
npm run test:loop:explain -- --staged
npm run test:focused -- --id <lane-id>
npm run test:smoke
npm test
npm run format:haxe:check
npm run public:preflight
```

Use the validated test-lane manifest for the implementation loop instead of
starting every change with `npm test`. Run the named semantic owner, then the
local smoke; complete Next/browser/compatibility evidence remains in CI and
publication preflight. Affected selection is observation-only until its
documented confidence window passes, and unknown or cross-cutting paths must
expand to full validation.

For meaningful behavior changes, record the concrete scenario, owning product
surface, expected red command and failure, independent source of the expected
result, and next broader proof. New framework capabilities begin with one real
Haxe → Genes → strict TypeScript → production Next → runtime/browser tracer
bullet before broad fixture expansion. Keep focused and real-boundary evidence
when they protect different failure modes, and do not use Todo, showcases,
packages, compatibility cells, or Genes evidence to advance another surface's
claim. High-risk compiler/runtime/publication/security/migration/claim changes
receive a separate verification pass. The full workflow and scorecards are in
`docs/testing-behavior-workflow.md` and `docs/testing-surfaces.md`.

## Architecture Overview

NextJsHx compiles typed Haxe through `genes-ts`, then generates narrow,
manifest-owned TypeScript/TSX adapters for Next.js App Router conventions. The
result remains an ordinary Next.js application. Public APIs are split between a
faithful `nextjs.raw.*` binding layer and typed `nextjs.*` ergonomics.

## Conventions & Patterns

Read and follow [AGENTS.md](AGENTS.md). In particular: use Beads for durable
tracking, keep sibling repositories read-only, avoid untyped escape hatches,
put every framework-neutral Haxe-to-TypeScript/JavaScript mechanism in
`genes-ts` so WordPressHx/Gutenberg and other Haxe-to-JS/TS projects can reuse
the same tested capability, treat reusable React/HXX/Hook mechanisms as
`genes.react` concerns, keep only Next.js-specific composition in this
repository, prefer module-level Haxe functions and values over all-static shell
classes unless class identity or a framework/compiler contract genuinely
requires one, and treat examples as executable teaching material with friendly
why/what/how documentation and an equally idiomatic vanilla Next.js/TypeScript
comparison. Prefer familiar typed collection operations—including `map`,
`filter`, `find`, `findIndex`, `some`, `every`, `flatMap`, `reduce`,
`reduceRight`, and `at`—when both Haxe source and genes output stay close to
JavaScript/TypeScript. Inspect output and do not trade a clear loop for a
retained Lambda helper. hxnodejs is not the owner of language-level Array
ergonomics. Build reusable HXML inventory, filesystem watching, serialized
rebuilds, Haxe compiler-server lifecycle, structured build events, and durable
artifact publication from framework-neutral `@genes-ts/tooling`; NextJsHx owns
only the Next process, Next validation, application commands, last-good
admission, ownership policy, and framework diagnostics layered over those
primitives. Require executable evidence for capability claims, including warm
edit-loop latency and generated-file churn before making performance claims.

`@genes-ts/tooling` is not published to the npm registry today. The temporary
plan uses a `.tgz` from a GitHub release whose immutable-release setting has
been verified, with its exact source commit, URL, version, SHA-256, and lockfile
integrity recorded here. Until that reviewed archive exists, do not invent its
URL, add a registry dependency, run `npm publish`, copy Genes tooling into this
repository, or treat a local `file:` dependency as clean consumer evidence. Read
`docs/genes-tooling-distribution.md` before changing this dependency or its
release process.
