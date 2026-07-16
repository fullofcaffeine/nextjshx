# NextJsHx

NextJsHx is a Next.js-first framework layer for authoring Next.js applications
and reusable modules in typed Haxe. Haxe compiles to strict TypeScript/TSX
through `genes-ts`; narrow generated adapters materialize the exact filenames,
directives, and export shapes required by the App Router.

This repository is in foundation work. It has no supported release yet, and its
public API, package shape, compatibility matrix, and license are not final.

## Bootstrap

Prerequisites:

- Node.js `20.19.3` or `24.18.0` for repository evidence (Next.js engine
  floor: `>=20.9.0`)
- Haxe `4.3.7`
- Haxe formatter `1.18.0`
- Gitleaks `8.30.0`
- Beads (`bd`), `jq`, Git, and Python 3

```sh
npm ci --ignore-scripts
npx --no-install lix download
npx --no-install haxelib install formatter 1.18.0 --quiet
npm run hooks:install
bd prime
npm test
```

The current root test validates the imported implementation plan, compatibility
contract, repository security tooling, and the stable Next.js build/runtime
fixture. Broader product, compiler, and packed-consumer suites will be added by
their owning Beads issues.

## Compatibility contract

[support_matrix.json](support_matrix.json) is the machine-readable source of
truth for exact toolchain, framework, and evidence-lane identities. Its
human-readable view is generated at
[docs/compatibility.md](docs/compatibility.md).

```sh
npm run test:support-matrix
npm run support:discover
```

The first command needs no sibling repository. Discovery optionally validates
read-only genes-ts and Next.js source checkouts, reports missing checkouts
without failing the stable-package lane, and accepts explicit paths through
`NEXTJSHX_GENES_TS_DIR` and `NEXTJSHX_NEXT_UPSTREAM_DIR`. Use
`npm run support:require-genes` or `npm run support:require-upstream` only when
running those source-oracle lanes.

## Stable integration fixture

The required package lane compiles typed Haxe 4.3.7 through the exact
genes-ts commit into split, extensionless ESM TS/TSX, then runs Next 16.2.10
type generation, strict TypeScript 6.0.2 checking, a production build, and an
HTTP smoke test on both supported Node lanes in CI.

```sh
npm run test:fixture:next-stable
npm run test:fixture:next-stable:smoke
```

The dependency contract pins React and React DOM 19.2.7. It also locks the
TypeScript compatibility wrapper's compiler core to 6.0.2 and overrides
PostCSS to 8.5.10; `npm run security:audit` rejects moderate-or-higher audit
findings, while the production fixture verifies those resolutions work with
the pinned Next release.

## Architecture constraints

[Architecture](docs/architecture.md) and its accepted ADRs are normative for
implementation decisions.

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
