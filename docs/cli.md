# Command-line workflow

The NextJsHx CLI is the host-native coordinator between typed Haxe, the closed
adapter plan, manifest-owned TypeScript adapters, and Next.js's own validation
tools. It executes binaries directly without a shell, never imports executable
configuration, and does not infer ownership from a directory scan.

The CLI is still an internal foundation package rather than a supported npm
release. From this repository, invoke it through the workspace script:

```sh
npm run nextjshx -- --help
npm run nextjshx -- setup
npm run nextjshx -- generate
npm run nextjshx -- clean
npm run nextjshx -- adopt src/app/catalog/page.tsx
npm run nextjshx -- release src/app/catalog/page.tsx
npm run nextjshx -- repair src/app/catalog/page.tsx
npm run nextjshx -- profile show
npm run nextjshx -- typecheck
npm run nextjshx -- routes
npm run nextjshx -- boundaries
npm run nextjshx -- doctor
npm run nextjshx -- build -- --turbopack
npm run nextjshx -- dev -- -p 3000
```

Every project command starts from the current directory, discovers the nearest
application package, and requires its closed `nextjshx.config.json`. Pass
`--config <path>` only when explicitly selecting the config at that same
discovered package root. Unknown commands, flags, duplicate flags, and flag
values with no argument fail with `NXHX-CLI-USAGE-0001`.

## `setup`

```sh
nextjshx setup [--json] [--typed-routes]
```

`setup` prepares a discovered TypeScript App Router package for gradual Haxe
adoption. It verifies the installed Next.js, TypeScript, Haxe, genes-ts, and
NextJsHx Haxe-library capabilities, then creates or validates:

- versioned `nextjshx.config.json`;
- a manifest-owned compiler session under `.nextjshx/toolchain/`;
- a small typed Haxe home page only when no native root `page.js`, `.jsx`,
  `.ts`, or `.tsx` exists;
- missing `.next/`, `.nextjshx/`, and `src-gen/` ignore entries; and
- missing `dev`, `generate`, and `typecheck` package scripts.

Application config contains source roots, Next capabilities, and output policy;
it cannot override compiler-owned genes defines, planner installation, output
extensions, or pinned toolchain identities. The generated HXML, empty compiler
entry point, and complete released planner installer are private implementation
files. Commands regenerate them deterministically from config and verify their
manifest before compiling. Do not check them in or edit them.

Every existing application path is preserved. A byte-identical setup file is reported
unchanged; different bytes, symbolic links, executable Next config, native
routes, and existing package scripts are reported as preserved with the exact
proposed alternative. The package lock is never written. The `dev` proposal is
`nextjshx dev --`, so ordinary `npm run dev -- -p 3100` arguments flow through
the reviewed Next argument boundary.

Package metadata is replaced only after its original digest is rechecked, and
its mode is retained. Install the pinned NextJsHx Lix scope for the same
reviewed release or source revision as the CLI before invoking `setup`; the
command fails before mutation when `-lib nextjshx` cannot be resolved.

`init` remains a deprecated compatibility alias for `setup`. A conventional
schema-v1 config can be migrated only when setup proves that its HXML contains
the released libraries, classpaths, output, package includes, full DCE, and one
released AdapterPlan installer. Custom defines, macros, or HXML behavior fail
before setup writes. Authored legacy files are preserved for deliberate later
cleanup; maintained schema-v2 applications do not need them.

Setup snapshots every application file it may change and records the
directories that were absent before it began. If a later setup stage fails, it
restores exact prior bytes and modes, removes only setup-created files, and
prunes only still-empty directories that setup created. A concurrent change
during rollback is preserved and reported instead of overwritten.

Compiler-toolchain publication is independently transactional: it stages a complete tree,
verifies exact prior ownership, swaps atomically, and restores the exact
previous tree if publication fails. An unowned, modified, missing, or symlinked
entry blocks the complete update. Repeated setup is byte-stable.

Typed routes are disabled by default. `--typed-routes` creates a minimal
`next.config.mjs` only when no `next.config.js`, `.mjs`, `.ts`, or `.mts`
exists. It never executes or rewrites an existing Next config; when one exists,
it reports a manual reviewed patch and keeps `nextjshx.config.json` disabled.
When an existing NextJsHx config has typed routes disabled, the command likewise
reports manual action and does not create a contradictory Next config.

Positive example: a new TypeScript App Router package receives the complete
baseline and three missing scripts; the second invocation reports unchanged
and produces no byte changes.

Negative control: an existing native `src/app/page.tsx`, custom `dev` script,
unsupported custom legacy HXML, and executable `next.config.mjs` remain
byte-for-byte intact. The result reports each collision or migration blocker
and prints the safe next action.

## `profile`

```sh
nextjshx profile show [--json] [--config <path>]
nextjshx profile list [--json] [--config <path>]
nextjshx profile validate [--json] [--config <path>]
nextjshx profile diff --to <language/intent> [--json] [--config <path>]
```

These commands inspect the configured output language and intent without
generating or publishing files. `show` reports the selected cell, profile
version, deterministic fingerprint, current maturity, migration state, and
known unsupported capabilities. `list` adds the complete closed profile-cell
registry. `validate` reports the same facts and exits nonzero until the
configured cell has completed every recorded release gate. `diff` compares the
configured policy with one explicit `typescript|javascript` and
`reviewable|optimized` target, reporting its fingerprint, maturity, policy
field changes, derived compiler-define changes, and capability gaps.

The maturity registry is deliberately honest: a profile accepted by the config
schema is not thereby qualified for release. Unsupported work is named rather
than silently weakening source maps, declarations, analyzer visibility, output
quality, or static checking. Environment variables such as `NODE_ENV` do not
select or alter a profile.

Positive example: `profile show --json` can be used by CI to record the exact
profile fingerprint without changing `nextjshx.config.json`, `.nextjshx/`, or
the ownership manifest. Negative control: `profile validate` exits with status
1 for a preview, experimental, or planned cell while still returning its
structured result. `profile diff` is deliberately a policy/compiler-input
comparison at this stage; it does not claim to build or compare implementation
trees before isolated alternate-root generation exists. Transactional profile
switching and generated-tree inspection are separate follow-up work; these
read-only commands do not imply mutation authority.

## `clean`

```sh
nextjshx clean [--json] [--config <path>]
```

`clean` removes the complete verified adapter ownership set through the same
lock, exact-hash preflight, journal, rollback, and manifest-last publisher used
by `generate`. It supplies an empty intended output tree; it does not scan the
App Router directory for files that merely look generated.

Every manifest record is checked before the first output is deleted. A missing
manifest is a mutation-free success because NextJsHx owns nothing. A malformed
manifest, missing owned output, changed digest, symlinked target, containment
failure, or active transaction blocks the complete clean. There is no
`--force` flag.

After successful removal, the CLI prunes only empty parent directories below
the configured App Router root. A directory containing native CSS, components,
tests, assets, or any other sibling remains. The canonical empty ownership
manifest is retained; it explicitly records zero owned outputs and makes a
repeated clean idempotent.

Positive example: one verified generated `src/app/todos/page.tsx` beside a
native `src/app/todos/styles.css` is removed while the stylesheet and its
directory remain.

Negative control: if a second manifest-owned adapter was hand-edited, clean
reports its expected and current digest and preserves both the edited adapter
and every otherwise-valid owned sibling. Replacing an owned target with a
symlink likewise preserves the complete tree.

## `adopt`, `release`, and `repair`

```sh
nextjshx adopt <path> [--json] [--config <path>]
nextjshx release <path> [--json] [--config <path>]
nextjshx repair <path> [--json] [--config <path>]
```

These commands transfer or repair exactly one adapter. Each compiles a fresh
Haxe plan, proves every other manifest entry and live file is unchanged,
journals ownership and live-byte state separately, publishes atomically, and
runs Next route type generation plus strict TypeScript.

- `adopt` moves a byte-identical native adapter into Haxe ownership without
  rewriting it. The path must be absent from the old manifest and present in
  the fresh Haxe plan.
- `release` removes ownership without removing or rewriting the verified file.
  Remove the owning Haxe declaration first so the fresh plan omits the path.
- `repair` restores one missing or modified owned adapter from the same Haxe
  source identity and adapter kind. Failure restores the exact prior bytes,
  mode, and manifest.

There is no force option. Traversal, symlinks, special files, unrelated drift,
wrong operations, changed ownership identities, or failed validation block the
whole transaction.

Positive example: after removing a Haxe route declaration,
`nextjshx release src/app/catalog/page.tsx` leaves the adapter in place as
ordinary native Next.js source. Negative control: `adopt` rejects a native file
that differs by one byte from the freshly formatted adapter and leaves the
manifest untouched.

## `generate`

```sh
nextjshx generate [--json] [--no-check] [--config <path>]
```

`generate` performs one complete ownership transaction:

1. recover or roll back any journaled interrupted publication whose live bytes
   still match an authorized state;
2. run the configured Haxe build with every configured define and a fresh
   `.nextjshx/plans/<uuid>.json` plan override;
3. require the exact NextJsHx, Haxe, genes-ts, and installed Next identities;
4. parse the plan as a closed canonical model and render only narrow delegating
   TypeScript/TSX adapters;
5. format and parse the complete adapter tree, then classify every path as
   `create`, `update`, `unchanged`, or `remove` against the verified manifest;
6. stage forward and rollback bytes, journal the transaction, publish adapters,
   and replace the ownership manifest last; and
7. run `next typegen .` followed by strict `tsc --project tsconfig.json
--noEmit`, committing only after both pass.

The normal result reports all four dispositions plus `blocked (0)`. A failed
ownership preflight reports the specific blocked target in human output and in
the JSON error envelope without converting it into an owned file. An unchanged
adapter is not rewritten, preserving its inode, mode, and modification time. `--no-check`
skips only the post-publication Next/TypeScript oracle; all plan, format,
syntax, path, ownership, lock, journal, and digest checks remain mandatory.
Use that flag only when a higher-level workflow will immediately run an
equivalent validation gate.

Positive example: changing one Haxe page, adding another, and deleting a third
can produce one `update`, one `create`, one `remove`, and any number of
`unchanged` adapters in a single committed generation.

Negative example: without the transaction boundary, a successful first file
write followed by a TypeScript error could leave a mixed App Router tree and a
misleading manifest. Here, the same TypeScript failure restores the exact prior
adapter and manifest bytes. A Haxe failure occurs before publication, while a
native unowned target or hand-edited owned target blocks the whole operation
without overwriting either file.

## `typecheck`

```sh
nextjshx typecheck [--json] [--config <path>]
```

`typecheck` compiles Haxe normally so genes-ts implementation output is current,
collects and renders a fresh adapter plan, and performs a non-mutating ownership
preflight. It requires every intended adapter to be byte-identical to the
verified live manifest before invoking Next. This prevents a false green result
where `next typegen` and TypeScript happened to inspect stale or absent
convention files.

On a current tree it runs `next typegen .`, resolves JSON/JSONC and extended
TypeScript configuration, requires effective `strict: true` with no strict
family option explicitly disabled, and runs strict no-emit TypeScript. If the
preflight reports a create, update, or removal, run `generate` first.

## `routes`

```sh
nextjshx routes [--json] [--check] [--config <path>]
```

`routes` compiles Haxe with `--no-output`, reads a fresh plan, and reports both
Haxe route intents and native `page.*`/`route.*` convention files under the
configured App Router root with:

- explicit `haxe` or `native` origin, source declaration/file, and adapter kind;
- App Router segment path, generated filesystem target, and public pattern;
- topology role (`canonical`, `parallel-view`, or `intercepted-view`), ordered
  slot ancestry, and an interception source-to-target record when present;
- parameter name, segment index, and cardinality (`single`, `catch-all`, or
  `optional-catch-all`);
- current ownership state (`planned`, `owned-current`, `owned-update`,
  `owned-modified`, `owned-missing`, `native`, `native-collision`, or `unsafe`);
- parity status.

The parameter report describes route grammar and cardinality. Haxe domain types
and codecs remain source-level contracts and are not reconstructed from the
schema-v1 adapter plan. Route groups and slots are retained in `segmentPath`
but removed from `publicPattern`, matching their URL behavior:

```text
/catalog/[sku] | native | page | src/app/(shop)/catalog/[sku]/page.tsx | topology=canonical | slots=none | interception=none | params=sku:single | ownership=native | parity=accepted
/photo/[id] | haxe | page | app/@modal/(.)photo/[id]/page.tsx | topology=intercepted-view | slots=modal | interception=(.):/->/photo/[id] | params=id:single | ownership=owned-current | parity=accepted
```

The scanner never claims or rewrites that file. It ignores Next private/hidden
directories and colocated non-convention files. It does not follow symlinks.
The supported native inventory uses Next's default `.js`, `.jsx`, `.ts`, and
`.tsx` route extensions. It understands named route groups, parallel slots,
and all four documented interception markers. Canonical owners must be unique;
parallel/intercepted view identity is unique per slot ancestry, intercepting
source, and canonical target; and every intercepted view must have a canonical
hard-navigation page. A candidate with a different simple extension,
malformed/ambiguous topology, duplicate ownership, an orphan interception, or a
non-final catch-all fails with `NXHX-CLI-ROUTE-0007` instead of inventing a
route:

```text
src/app/@modal/(.)photo/[id]/page.tsx
NXHX-CLI-ROUTE-0007: An intercepted view has no canonical hard-navigation page.
```

Before `generate`, `typecheck`, `routes --check`, `build`, or `dev` publishes
or trusts the future tree, the CLI also requires exactly one real, nonsymlink
`default.js`, `.jsx`, `.ts`, or `.tsx` for every named slot. A reviewed
`@:next.default("path/@slot")` intent satisfies the same check. Missing or
competing Haxe/native defaults fail before stale generated bytes can mask the
problem.

Custom `pageExtensions` remain native and outside this inventory until their
effective executable Next configuration can be obtained without duplicating
it. `--check` first requires the generated tree to be current, then runs Next
type generation and strict application TypeScript. It also writes owner-only
temporary `Route<literal>` assignments for every normalized public pattern,
checks them through a private extending tsconfig, and removes both probe files
in a `finally` cleanup. A route is labeled `accepted` only if those assignments
compile against Next's effective generated augmentation. The CLI does not edit
or parse `.next/types` as a stable API. The default is explicitly
`not-checked`.

## `boundaries`

```sh
nextjshx boundaries [--json] [--config <path>]
```

`boundaries` compiles a fresh path-sanitized Haxe evidence plan without
emitting implementation output. It reports classified Haxe owners, source
ranges, generated adapters and property contracts, direct typed dependencies,
and known generated boundary references. With a completed build from the
configured Next version, it safely joins exact Client Component adapters to
client-reference manifests, final static chunks, and observed bytes.

Facts are scoped as `haxe-known`, `next-observed`, or `unavailable`; native and
third-party transitive edges are never described as Haxe-complete. JSON uses
relative paths and `projectRoot: "."`. See
[component-boundary reports](clientification-reports.md) for examples, warning
budgets, limitations, and remediation.

## `doctor`

```sh
nextjshx doctor [--json] [--config <path>]
```

`doctor` is read-only apart from creating and removing its unique temporary
plan. It reports stable `NXHX-DOCTOR-*` checks for:

- the Node engine and exact Haxe 4.3.7 compiler;
- genes-ts 1.41.0 at the exact stable-release GitHub commit and the required `genes.ts`
  and `genes.ts.no_extension` defines;
- installed Next 16.2.12, React/React DOM 19.2.7, and TypeScript 6.0.2;
- the configured App Router root, Haxe build, generated root, and package
  scripts;
- effective strict TypeScript and the `.next/types` include;
- exact ownership-manifest bytes and digests;
- active journals, locks, journal temporaries, or residual transaction
  workspaces;
- a fresh canonical adapter plan and residual stale plan artifacts;
- an optional Next source oracle at version 16.3.0-canary.87 and exact commit
  `491f78099c3ea23be14e66c6d848b50204590e90`; and
- the remaining explicitly deferred App Router features.

`pass`, `warn`, `fail`, and `info` are distinct statuses. Any `fail` makes the
command exit nonzero. An unconfigured upstream checkout is informational; a
configured checkout with the wrong identity fails because it is claiming to be
an evidence oracle.

## `build`

```sh
nextjshx build [--json] [--config <path>] [-- <Next build flags>]
```

`build` is the complete production gate. It deliberately calls the real
framework commands instead of emulating Next.js:

1. run the complete doctor and stop on any failing prerequisite;
2. inspect the entire configured Haxe generated root, then remove it only when
   it is a dedicated real tree with no symlink, special, shared-writable,
   protected, or authored-looking entry;
3. run normal Haxe generation, require a freshly recreated safe generated
   tree, and transactionally publish the adapter plan;
4. run `next typegen .` and strict no-emit TypeScript inside that transaction;
5. invoke `next build .` with Next's type-error gate enabled;
6. reject output saying type validation was skipped or lacking the pinned
   `Running TypeScript` phase; and
7. compile a new no-output Haxe plan and require every rendered adapter to be
   byte-identical to the verified manifest.

The reviewed value-free flags from pinned Next 16.2.12 pass through unchanged:
`--debug`/`-d`, `--experimental-analyze`, `--experimental-cpu-prof`,
`--experimental-debug-memory-usage`,
`--experimental-next-config-strip-types`, `--no-mangling`, `--profile`, and
one of `--turbo`, `--turbopack`, or `--webpack`. Put them after `--` to make the
boundary explicit. Duplicates, conflicting bundlers, positional arguments, and
unknown flags fail closed against the exact supported Next version.

`--experimental-upload-trace` is intentionally blocked because trace upload can
send sensitive project data away from the build host. Partial/debug-path modes
and `--debug-prerender` (which Next itself marks as not for production) are also
blocked because they cannot prove a complete production build.
Run an exceptional Next invocation explicitly outside this acceptance gate if
you need one; its success is not reported as `nextjshx build` success.

Positive example: `nextjshx build -- --profile --webpack` cleans only
`src-gen/`, publishes an unchanged or updated adapter transaction, passes both
TypeScript gates and Next's full build, and reports the verified manifest
generation digest.

Negative example: without the final fresh-plan verification, a build-time tool
or concurrent source change could leave `.next` based on adapters that no
longer match Haxe intent. Here, a post-build `create`, `update`, or `remove`
classification fails with `NXHX-CLI-BUILD-0009`. A single symlink inside
`src-gen/` fails doctor before cleanup and preserves all sibling bytes.

## `dev`

```sh
nextjshx dev [--config <path>] [-- <Next dev flags>]
```

`dev` is the single long-running owner for Haxe generation and one native
`next dev` process. It performs an initial generation before starting Next,
then watches the configured Haxe graph and lets Next remain the only owner of
App Router recompilation, HMR, and React Fast Refresh. It does not add a second
browser reload protocol or rewrite Server and Client Component semantics.

On macOS with the reviewed Next 16.2.12 pin, a bare `nextjshx dev` selects
Next's supported Webpack backend. A reduced Next-only control showed that the
default Turbopack watcher could stop invalidating even a handwritten
`app/page.tsx`; polling and semantic adapter changes did not restore it, while
the same native edit and the full Haxe edit/error/recovery loop refreshed under
Webpack. The fallback is exact-version and platform scoped and must be
reevaluated with the next compatibility pin. An explicit `--turbopack`,
`--turbo`, or `--webpack` is always preserved byte-for-byte, and other
platforms retain Next's default backend.

The watch graph is derived from the real build inputs rather than a hard-coded
`src/` directory. It follows nested HXML files, `-cp`/`--class-path`,
`-resource`, scoped `haxe_libraries/*.hxml`, the nearest `.haxerc`, package and
lock files, `nextjshx.config.json`, and optional `haxe.extraInputs`. Ordinary
`.hx` edits reuse the current compiler identity. HXML, config, resource,
library, lock, or declared extra-input changes recompute the identity, replace
the watch graph, and restart only the invocation-owned Haxe compiler server.

Filesystem bursts are debounced and serialized. If files change while Haxe is
compiling, the active compile is never overlapped or cancelled halfway through
publication; all pending events collapse into exactly one newest-state pass.
An identity-changing event outranks an ordinary source event. This avoids both
concurrent writes to genes-ts output and the common watcher race where the last
edit in a burst is silently lost.

Native filesystem notifications remain the low-latency path, but they are not
treated as a correctness oracle: a bounded 250 ms metadata reconciliation pass
detects an event coalesced or dropped by the platform watcher. After a successful
compile, the CLI computes a deterministic digest for each adapter's transitive
graph of generated relative imports and embeds it in that generated convention
entry's provenance comment. A changed Haxe body or shared generated dependency
therefore produces a normal content update at every affected manifest-owned
Next entry; an unrelated generated module leaves that adapter byte-identical.
This avoids relying on an imported `src-gen` inode after genes-ts rewrites it in
place without touching, replaying, or transiently rewriting live files. Next
remains the sole compiler and Fast Refresh owner. The generated-tree scan rejects
links and special files and is capped at 10,000 files and 128 MiB.

Each invocation reserves a fresh loopback-only compiler port and never attaches
to an unknown existing server. When `haxe` resolves to Lix's Node shim, dev
reads the nearest pinned `.haxerc` and uses the matching real compiler binary
for Haxe's native `--wait`/`--connect` protocol; the shim remains valid for
direct compilation but injects protocol arguments that are incompatible with
the native server. If the exact real compiler cannot be resolved, the server
cannot start, or a connection fails, the affected generation falls back to a
bounded direct compile and reports that decision. A later edit may establish a
fresh owned server again.

An initial Haxe failure starts Next only when the existing generated tree and
every manifest-owned adapter are an exact verified last-good state with no
active publication journal. Otherwise dev fails with `NXHX-CLI-DEV-0010` and
does not expose a stale or partially owned application. After startup, a Haxe
syntax or type failure leaves that exact last-good tree and the one Next
process alive; the next valid edit publishes normally and reports `Haxe
recovered`. Raw tool output is streamed with stable `[haxe]`, `[next]`, and
`[nextjshx]` prefixes.

Reviewed Next 16.2.12 dev flags pass through byte-for-byte only after `--`:
`--turbopack`/`--turbo` or `--webpack`, `-p`/`--port`,
`-H`/`--hostname`, `--inspect`, `--disable-source-maps`,
`--no-server-fast-refresh`, `--experimental-cpu-prof`,
`--experimental-https` and its CA/cert/key values, and
`--experimental-next-config-strip-types`. Duplicate aliases, conflicting
bundlers, positional input, invalid ports, and unknown flags fail closed.
`--experimental-upload-trace` is blocked because Next warns that the trace can
contain sensitive project data.

`SIGINT`, `SIGTERM`, `SIGHUP`, or Next exit closes the watcher, aborts the active worker,
and terminates only the compiler and Next process groups created by this
invocation, with a bounded `SIGTERM` to `SIGKILL` escalation. It never kills an
unrelated Haxe or Next process by name.

Positive example: edit a Haxe Server Component, make a syntax error, and fix
it. The page Fast Refreshes after the first edit, remains on byte-identical
last-good generated output during the error, and Fast Refreshes again after
the fix without restarting Next.

Negative example: a naive `haxe --watch & next dev` shell script can overlap
two Haxe compiles, expose partially rewritten generated modules, reuse a stale
global compiler server, lose an edit received during compilation, or orphan a
child on Ctrl-C. While building this repository, a live fixture also showed
that Lix's Node Haxe shim cannot speak the native `--wait`/`--connect` protocol
unchanged. On macOS, the same fixture reproduced both a dropped Haxe source
notification and Turbopack missing the completed bytes of a rapidly rewritten
generated module. The owned native-binary resolution, reconciled serialized
dirty loop, implementation-graph adapter fingerprint, last-good verification, and process-group
cleanup address those observed failure modes rather than hiding them behind
test retries.

Maintained styled examples compose the same command with Tailwind's own watcher:

```sh
npm run dev --workspace @nextjshx/showcase-landing
npm run dev --workspace @nextjshx/showcase-blog -- --webpack -p 3100
```

Their small repository helper first rebuilds the internal CLI and stylesheet,
then owns the Tailwind watcher alongside `nextjshx dev`; either exit or a
terminal signal cleans up both owners. Application packages without a style
compiler can keep npm argument forwarding ergonomic by retaining the explicit
boundary in the script itself:

```json
{
  "scripts": {
    "dev": "nextjshx dev --"
  }
}
```

Then `npm run dev -- -p 3100` uses the reviewed platform default and forwards
the appended port to Next without requiring a second separator from the
developer. An explicit bundler remains available after that separator. The future
`nextjshx setup` workflow proposes this script only when it can preserve an
existing package script and show the change explicitly.

## Machine-readable output

All finite commands accept `--json`. The long-running `dev` event stream
does not: passing `--json` fails with `NXHX-CLI-USAGE-0001`. Finite-command
success uses one stable envelope:

```json
{
  "ok": true,
  "result": {
    "command": "routes"
  }
}
```

Failures go to standard error, exit nonzero, and preserve the originating
diagnostic rather than flattening it:

```json
{
  "ok": false,
  "error": {
    "code": "NXHX-CLI-TYPECHECK-0006",
    "message": "typecheck refuses to validate stale or unpublished adapter bytes.",
    "subject": "generated adapter tree",
    "expected": "every planned output classified unchanged against the verified manifest",
    "actual": "update:src/app/orders/[id]/page.tsx",
    "resolution": "Run nextjshx generate, review the transaction result, then rerun this validation command.",
    "docs": "docs/cli.md"
  }
}
```

An ownership failure from `generate` additionally includes a top-level
`"blocked": ["project/relative/target.tsx"]` array. Successful generation keeps
`result.blocked` as an empty array because publication cannot commit a partial
tree. A successful build JSON result includes its pass-through arguments,
cleaned and freshly generated entry counts, publication result, manifest
generation, and verified-output count, but omits the potentially large raw Next
build log; human output retains that log.

CLI-originated diagnostics use `NXHX-CLI-*`; config, ownership, and transaction
failures retain their narrower stable families and documentation links. Raw
Haxe, Next, and TypeScript output is bounded and attached to the actionable
process diagnostic. No command executes through a shell or falls back to a
package-manager script lookup.

Focused evidence is available through:

```sh
npm run test:cli
npm run test:dev
```

The suite covers plan injection rejection, canonical rendering, complete change
reporting, Haxe failure isolation, validation rollback, stale-tree refusal,
blocked native targets, route cardinality and parity, exact upstream identity,
transaction-state diagnosis, the complete production-build order and failure
matrix, safe cleanup, Next flag policy, skipped type checking, post-build drift,
and success/error JSON envelopes.
`test:dev` additionally runs a real Next browser session through valid Haxe
edit, syntax failure, exact last-good retention, recovery, Fast Refresh, and
bounded process cleanup.
