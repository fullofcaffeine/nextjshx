# NextJsHx

NextJsHx is a Next.js-first framework layer for authoring Next.js applications
and reusable modules in typed Haxe. Haxe compiles to strict TypeScript/TSX
through `genes-ts`; narrow generated adapters materialize the exact filenames,
directives, and export shapes required by the App Router.

This repository is in foundation work. It has no supported release yet, and its
public API, package shape, compatibility matrix, and license are not final.

## Bootstrap

Prerequisites:

- Node.js `>=20.9.0`
- Haxe `4.3.7`
- Haxe formatter `1.18.0`
- Gitleaks `8.30.0`
- Beads (`bd`), `jq`, Git, and Python 3

```sh
npm ci
haxelib install formatter 1.18.0
npm run hooks:install
bd prime
npm test
```

The current root test validates the imported implementation plan. Product,
compiler, Next.js, and packed-consumer suites will be added by their owning
Beads issues.

## Architecture constraints

- Next.js remains the runtime, router, compiler, bundler, and deployment model.
- `nextjs.raw.*` models supported public Next.js APIs faithfully.
- `nextjs.*` adds typed Haxe ergonomics without hiding native semantics.
- Generated convention adapters are short, deterministic, and manifest-owned.
- Native TypeScript/JavaScript routes are never overwritten implicitly.
- Generic compiler gaps are reduced and fixed in `genes-ts`; Next-specific
  behavior stays in NextJsHx.
- Repository-owned Haxe and generated public APIs do not use unreviewed
  `Dynamic`, `Any`, `untyped`, broad `unknown`, or unchecked casts.

The detailed product contract is in
[nextjshx-prd.md](nextjshx-prd.md). Live execution state is in Beads; the seed
JSON and Markdown are reproducible bootstrap artifacts, not a second tracker.

## Public-repository safety

Install the tracked hooks before contributing:

```sh
npm run hooks:install
```

Pre-commit formats staged repository-owned Haxe, rejects whitespace and
machine-local path leaks, and scans staged content for secrets. Pre-push scans
all reachable Git history. Before changing visibility or publishing a ref, run:

```sh
npm run public:preflight
```

Beads data uses a separate Dolt ref. Publish it only through:

```sh
npm run beads:push
```

That wrapper scans decoded current and historical issue records before
invoking `bd dolt push`. Do not put secrets or private vulnerability details in
GitHub issues, pull requests, CI logs, generated files, or Beads.
