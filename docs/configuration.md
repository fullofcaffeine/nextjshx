# Configuration and project discovery

NextJsHx reads one declarative `nextjshx.config.json` from the Next application
package root. It never imports JavaScript, evaluates JSON5, expands environment
variables, or executes package scripts while loading configuration.

The machine-readable schema is
[nextjshx-config.schema.json](../schemas/nextjshx-config.schema.json). Version 2
uses this complete shape:

```json
{
  "$schema": "https://nextjshx.dev/schemas/config-v2.json",
  "schemaVersion": 2,
  "appRoot": "src/app",
  "boundaries": {
    "maxDirectDependencies": 8,
    "maxObservedClientBytes": 65536
  },
  "haxe": {
    "hxml": "build.hxml",
    "generatedRoot": "src-gen",
    "defines": ["myapp.feature=enabled"],
    "extraInputs": ["schema/domain.json"]
  },
  "next": {
    "package": "next",
    "upstreamDir": "../next.js",
    "typedRoutes": true,
    "cacheComponents": true,
    "experimentalCacheDirectives": []
  },
  "output": {
    "manifest": ".nextjshx/manifest.json",
    "format": "project",
    "language": "typescript",
    "intent": "reviewable",
    "profileVersion": 1,
    "sourceMaps": "external",
    "sourcesContent": true,
    "declarations": "public",
    "jsxRuntime": "automatic"
  }
}
```

`schemaVersion`, `haxe`, `next`, and `output` are required. `$schema` is
optional, but when present it must identify schema version 2. `appRoot` is
optional only to support safe discovery during initialization: exactly one of
`app/` and `src/app/` must exist when it is omitted. `next.upstreamDir` is an
optional read-only source oracle and may contain parent segments; it never
becomes a runtime or publication dependency.

The output language and output intent are independent, explicit build policy:

- `language` is `"typescript"` or `"javascript"`;
- `intent` is `"reviewable"` or `"optimized"`;
- `profileVersion` pins the released meaning of that pair and is currently `1`;
- `sourceMaps` is `"external"`, `"inline"`, or `"none"`;
- `sourcesContent` controls whether source content is embedded in maps;
- `declarations` is `"public"`, `"all"`, or `"none"`; and
- `jsxRuntime` is `"automatic"` or `"classic"`.

The CLI uses the same configured profile for development, checking, testing,
and production builds. It never silently changes intent for production.
TypeScript plus reviewable output is the schema-v2 default emitted by
`nextjshx init`. The selected profile deterministically supplies genes-ts
compiler defines; those implementation details are no longer application
configuration.

Schema-v1 files remain readable for a bounded migration window. The loader
derives an equivalent reviewable TypeScript or JavaScript profile from the
formerly configured, supported genes-ts defines. Contradictory or custom
compiler policies fail instead of being guessed. Loading v1 returns a migration
report that lists compiler-owned defines to remove and preserves only
application-owned defines. Reading the file does not rewrite it; an explicit
migration command will own publication in a later tooling slice.

`haxe.extraInputs` is optional and defaults to an empty array. It names
project-relative files or directories that affect Haxe generation but are not
discoverable from classpaths, nested HXML, or `-resource` arguments. The dev
watcher rebuilds and restarts its isolated compiler server when one changes;
the paths grant no generated-output ownership.

`boundaries` is optional and defaults to an empty object. Its non-negative
integer fields enable `nextjshx boundaries` warnings:
`maxDirectDependencies` covers project-local direct Haxe edges, while
`maxObservedClientBytes` covers distinct final static chunks exposed for an
exact generated adapter by a compatible completed Next build. Missing evidence
stays explicitly unavailable instead of being estimated. See
[component-boundary reports](clientification-reports.md).

`next.cacheComponents` defaults to `false`. When true, it authorizes semantic
cache declarations and causes the CLI to supply the private compiler capability
define; the application must separately set `cacheComponents: true` in its
native `next.config.*`. The optional `experimentalCacheDirectives` array may
contain the unique literals `"private"` and `"remote"` only when Cache
Components are enabled. Each is a deliberate capability, not a fallback chosen
automatically by the compiler. See the
[Cache Components reference](cache-components.md) for the boundary and host
configuration contract.

All other configured paths use portable forward slashes, are relative to the
application package, and cannot contain absolute, dot, parent, empty, or
backslash segments. `next.package` is an npm dependency name rather than a
filesystem path or URL. The ownership manifest remains a JSON control file
under `.nextjshx/`. Haxe defines use compact `name` or `name=value` syntax and
must be unique. All `genes.*`, `dts`, and `nextjshx.*` compiler mechanism
defines are reserved in schema v2. In particular,
`nextjshx.adapter-plan-output`,
`nextjshx.boundary-plan-output`, `nextjshx.app-root`,
`nextjshx.generated-root`, `nextjshx.cache-components`,
`nextjshx.experimental.cache-private`, and
`nextjshx.experimental.cache-remote` are reserved because the CLI supplies the
fresh plan transaction path, the two validated roots used to derive adapter
imports, and the cache capabilities derived from validated configuration.
Unknown keys at every level fail by default so a typo cannot silently change
generation.

`haxe.generatedRoot` grants the production `build` command authority to remove
that tree before compiling Haxe. It must therefore be dedicated to compiler
output. Doctor and build reject overlap with the App Router, `pages`, `public`,
dependencies, `.next`, `.nextjshx`, or Git state; protected project inputs,
symlink traversal, group/other-writable components, special files, nested
control roots, and authored-looking Haxe or project configuration also block
cleanup. Inspection completes before removal, so one unsafe entry preserves
the entire tree for review. After Haxe succeeds, build requires that exact root
to have been recreated and revalidates the new tree before invoking Next.

## Discovery result

Project discovery begins at an existing file or directory and returns distinct
absolute paths for:

- the nearest package containing `package.json`;
- the nearest owning workspace whose standard workspace declaration includes
  that package;
- the configured or unambiguous App Router root;
- the Haxe build, generated tree, ownership manifest, and optional upstream
  checkout; and
- the declared and, when installed, actual Next.js package version.

The package manager comes from an exact `packageManager` field and matching
lockfile evidence for npm, pnpm, Yarn, or Bun. Conflicting lockfiles, different
nested package-manager versions, ambiguous App Router roots, an undeclared Next
package, and an App Router symlink escaping the package all fail closed.

The pre-init call may set `requireConfig` to false. That relaxes only the
presence of `nextjshx.config.json`; package, workspace, package-manager, App
Router, and Next dependency validation still run.

## Stable diagnostics

Configuration failures use `NXHX-CONFIG-*` codes and carry the failing subject,
expected contract, safe resolution, and this document path. The initial ranges
are:

| Range | Contract |
| --- | --- |
| `NXHX-CONFIG-READ/JSON-0001..0002` | File presence and strict JSON parsing |
| `NXHX-CONFIG-SHAPE/UNKNOWN/REQUIRED-0003..0005` | Closed object shape |
| `NXHX-CONFIG-VERSION/VALUE/PATH/PACKAGE-0006..0009` | Versioned field values |
| `NXHX-CONFIG-PROJECT/WORKSPACE-0010..0011` | Package and workspace identity |
| `NXHX-CONFIG-PACKAGE-MANAGER-0012` | Unambiguous package-manager evidence |
| `NXHX-CONFIG-APP-ROOT/NEXT-PACKAGE/SYMLINK-0013..0015` | Framework and containment checks |

Focused evidence is available through:

```sh
npm run test:config-discovery
```
