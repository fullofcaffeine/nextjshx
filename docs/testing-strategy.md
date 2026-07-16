# Testing strategy

NextJsHx uses small evidence layers so a generated snapshot cannot substitute
for a real type check or runtime result. The baseline harness is intentionally
framework-light: later Beads add feature fixtures to these contracts rather
than inventing one-off runners.

## Baseline commands

```sh
npm run test:haxe:positive
npm run test:haxe:negative
npm run test:snapshots
npm run test:package-shape
npm run test:harness
```

`test:harness` runs all four layers. The root `npm test` also runs the strict
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

## Compiler-upstream changes

If a fixture exposes a genes-ts compiler gap, first reduce it to a generic,
framework-neutral reproduction. Any compiler fix belongs in an isolated
worktree of `../genes`, must remain uncoupled from NextJsHx, and must pass the
complete genes-ts TypeScript and classic-JavaScript regression suites before a
pull request is opened. NextJsHx records the tested commit only after that
upstream change is available remotely.
