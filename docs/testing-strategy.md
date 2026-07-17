# Testing strategy

NextJsHx uses small evidence layers so a generated snapshot cannot substitute
for a real type check or runtime result. The baseline harness is intentionally
framework-light: later Beads add feature fixtures to these contracts rather
than inventing one-off runners.

## Baseline commands

```sh
npm run test:haxe:positive
npm run test:haxe:negative
npm run test:adapter-plan
npm run test:routes
npm run test:snapshots
npm run test:package-shape
npm run test:compiler-gaps
npm run test:harness
```

`test:harness` runs all seven layers. The root `npm test` also runs the strict
Next fixture and production HTTP smoke, so it remains the complete local gate.

## Positive and negative Haxe fixtures

[tests/haxe/fixtures.json](../tests/haxe/fixtures.json) is validated against a
closed JSON Schema. A positive entry names a repository-relative `.hxml` build
that must exit successfully. A negative entry additionally records the exact
nonzero exit, stable `NXHX-*` diagnostic code, source file, line, character
range, and message. The negative runner rejects a changed location, a changed
code, an extra NextJsHx diagnostic, and an unexpected success.

Keep negative fixtures focused on one contract. When adding one:

1. Put its Haxe input and build file under `tests/negative/<case>/`.
2. Emit one actionable diagnostic with a stable category code.
3. Add the exact expected diagnostic to `tests/haxe/fixtures.json`.
4. Run `npm run test:haxe:negative` and review the failure before accepting any
   expectation change.

## Adapter-plan evidence

`npm run test:adapter-plan` produces the schema-v1 plan from real typed Haxe
declarations without generating or executing application JavaScript. Forward
and reverse registration orders must produce identical bytes, and the result
must validate against
[schemas/adapter-plan.schema.json](../schemas/adapter-plan.schema.json) and the
reviewed snapshot. The fixture also checks repository-relative type, field, and
metadata ranges.

The duplicate-target case starts with sentinel plan bytes. Compilation must
fail with one exact `NXHX-PLAN-DUPLICATE-0001` diagnostic at the canonical
conflicting source range while leaving that sentinel unchanged. This proves
complete plan validation precedes plan publication; it does not grant
permission to write an App Router target.

## Route-pattern evidence

`npm run test:routes` parses root, static, dynamic, catch-all, optional
catch-all, String-backed abstract, and codec-backed domain routes from real
typed Haxe declarations. Forward and reverse registration orders must produce
the same canonical model and match
[route-patterns-v1.json](../tests/snapshots/route-patterns-v1.json). The builds
use `--no-output`, and the runner rejects both application JavaScript and an
absolute compiler-host path in the result.

The negative matrix compiles one failure at a time and compares the exact
source file, line, character or line range, stable diagnostic code, and
message. It covers unsafe and malformed paths, deferred route groups,
unsupported slots and interception markers, duplicate or misplaced params,
missing and extra fields, every wrong cardinality, optional fields, and invalid
or missing codecs. The fixture classpath includes the installed genes-ts source
directly so optional catch-all evidence checks the actual
`genes.ts.Undefinable<Array<String>>` type without activating runtime code
generation. The normative contract is documented in
[route-patterns.md](route-patterns.md).

## Generated snapshots

`npm run test:snapshots` compiles the pinned stable fixture from scratch and
compares the complete split genes-ts output tree with
`tests/snapshots/next-stable-generated/`. It checks missing, extra, and changed
files after normalizing only line endings and trailing whitespace.

To update intentionally:

```sh
npm run test:snapshots:update
git diff -- tests/snapshots
npm run test:snapshots
```

Snapshot updates are disabled in CI. Review the generated imports, exports,
directives, types, and manifest; never update snapshots merely to silence a
failure.

## Strict TypeScript and packed consumers

Fixture TypeScript configurations retain `strict: true`, `skipLibCheck: false`,
and `noEmitOnError: true` where emitting a consumer. Next build type errors are
not disabled. The package-shape harness performs `npm pack`, checks the exact
tarball allowlist and integrity, installs that local tarball into an isolated
consumer with lifecycle scripts disabled and npm in offline mode, runs strict
TypeScript, and executes the emitted ESM.

The current artifact is a deliberately tiny harness self-test. The release
packaging Bead will point the same clean-consumer flow at the real npm CLI and
Haxelib artifacts once those packages exist.

## Generic compiler-gap evidence

`npm run test:compiler-gaps` compiles the same framework-neutral Haxe source
through genes-ts TypeScript and classic JavaScript/declaration profiles. Strict
TypeScript consumers validate both. The runner records missing output shapes
as deliberate drift assertions, so adopting a new compiler commit requires an
explicit inventory review rather than silently changing the evidence.

The [compiler gap inventory](compiler-gap-inventory.md) records each reduced
input, desired TypeScript and JavaScript output, current output, workaround,
risk, priority, and owning Bead. Repro source must not contain downstream
framework names or paths.

## Compiler-upstream changes

If a fixture exposes a genes-ts compiler gap, first reduce it to a generic,
framework-neutral reproduction. Any compiler fix belongs in an isolated
worktree of `../genes`, must remain uncoupled from NextJsHx, and must pass the
complete genes-ts TypeScript and classic-JavaScript regression suites before a
pull request is opened. NextJsHx records the tested commit only after that
upstream change is available remotely.
