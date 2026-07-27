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
npm test
npm run format:haxe:check
npm run public:preflight
```

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
repository, and require executable evidence for capability claims.
