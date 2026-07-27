# Generated-output publication and recovery

NextJsHx publishes generated adapters as one project-scoped transaction. The
publisher consumes a complete output set, formats and parses every TypeScript
file, reruns the pure ownership preflight, durably stages both forward and
rollback bytes, and only then receives authority to mutate live files. A
formatter, parser, collision, staging, or backup failure therefore leaves the
live App Router tree untouched.

This layer builds on
[generated-output ownership](generated-output-ownership.md). The ownership
manifest proves which live bytes may be replaced; the transaction journal
proves which exact previous and intended states recovery may act on. Neither
contract provides a force flag.

## Control layout

All control state is below the reserved real directory `.nextjshx/`:

```text
.nextjshx/
  publish.lock
  transaction.json
  plans/<uuid>.json
  transactions/<uuid>/
    stage/manifest.json
    stage/outputs/<project-relative-output>
    backup/manifest.json
    backup/outputs/<project-relative-output>
```

`publish.lock` is created exclusively and records a random identity, transaction
identity, PID, and hostname. A second publisher fails with
`NXHX-TRANSACTION-LOCKED-0001`; it never waits while holding partially prepared
state. Only recovery may clear a lock, and only when its same-host PID is
provably dead. A foreign-host, malformed, changed, or live-PID lock is
preserved.

The CLI requests one unpredictable plan path for each Haxe process and removes
that regular file after parsing it. The `plans/` directory is reserved control
state, never an ownership-manifest location or an adapter output root. A stale
plan is not reused to satisfy a later successful or failed compiler process.

The journal conforms to
[generated-output-transaction.schema.json](../schemas/generated-output-transaction.schema.json).
Schema v1 is closed and records only portable project-relative paths, explicit
output roots, exact convention files, file dispositions, exact
previous/intended SHA-256 values and modes, manifest identities, and one phase.
Every changed path must be below a recorded root or equal one recorded file;
the parser rejects redundant, duplicate, non-canonical, or widened authority.
It contains no workstation path,
command line, environment value, source text, or credential-shaped context.
The staged and backup manifests must agree exactly with the journal transition
before either publication or recovery proceeds.
The configured ownership manifest may live below `.nextjshx/`, but it may not
be `transaction.json` or anything below `transactions/` or the CLI's `plans/`
workspace; config parsing,
ownership preflight, the JSON Schemas, and journal parsing all reject those
control-plane collisions.

## Formatting and staging

The built-in formatter uses the pinned TypeScript parser and printer with LF
output. Input and formatted output must both be valid UTF-8 TypeScript/TSX.
Every formatter, including an injected project formatter, runs twice; different
second-pass bytes fail with `NXHX-TRANSACTION-FORMAT-0005`. TypeScript syntax
errors fail with `NXHX-TRANSACTION-SYNTAX-0006` and include the first parser
code and source location.

The complete formatted output tree is written under the transaction's private
staging directory. Every update and removal also receives an exact-byte private
backup; the previous manifest is backed up without normalizing its JSON bytes.
All artifacts are synchronized and rehashed before the journal is published.
Control data and live output must be on one filesystem so forward writes can
hard-link complete staged bytes into a UUID-scoped temporary name and atomically
rename them into place. This prevents a crash from exposing a partially written
adapter.

## Publication protocol

The publisher follows this order while holding the exclusive lock:

1. format and syntax-check the complete intended tree;
2. run pure ownership, containment, collision, and checksum preflight;
3. stage every intended output and create exact rollback backups;
4. verify all live bytes still match the previous state;
5. atomically write a `prepared` journal, then advance it to `publishing`;
6. atomically create or replace changed adapters and unlink only verified stale
   owned adapters; unchanged adapters are never renamed, rewritten, or chmodded;
7. atomically replace the ownership manifest last;
8. record `published` and run the caller's post-publication validation oracle;
9. after successful validation, verify every intended digest, record
   `committed`, and remove the journal and transaction workspace.

The validation oracle is where the CLI supplies `next typegen` and strict
TypeScript checking. If it fails, the publisher first records `rolling-back`,
restores the exact previous manifest, then restores or removes adapters in
reverse order. It verifies the fully restored state before deleting recovery
evidence and reports `NXHX-TRANSACTION-VALIDATION-0008`.

The higher-level `nextjshx build` command continues only after that transaction
commits. It runs native `next build` with framework type errors enabled, then
collects a second fresh no-output Haxe plan and requires every intended adapter
to classify as `unchanged` against the committed manifest. A Next failure or
post-build drift fails the production gate, but it does not pretend that an
already validated, committed publication is still an open transaction.

For example, changing owned `src/app/orders/[id]/page.tsx`, adding
`src/app/about/page.tsx`, and removing an owned stale route publishes all three
before replacing the manifest. An existing native `about/page.tsx`, a
hand-edited owned orders adapter, or a formatter error rejects the complete
operation before the first live write; matching intended bytes do not allow a
native file to be claimed.

## Recovery decisions

Recovery reacquires the same project lock, validates the journal and every
artifact, removes only UUID-scoped transaction temporary files, and hashes the
complete live transition before changing it.

| Journal phase | Required live state | Recovery action |
| --- | --- | --- |
| `prepared` | every file and manifest exactly previous | discard staged transaction |
| `publishing` | each output is exactly previous or intended; an intended manifest requires every intended output | restore the complete previous state |
| `published` | every output and manifest exactly intended | rerun a supplied validator and commit on success; otherwise restore previous |
| `rolling-back` | each output and manifest is exactly previous or intended | resume exact previous-state restoration |
| `committed` | every output and manifest exactly intended | retain live bytes and finish control cleanup |

An output or manifest matching neither journaled state stops recovery with
`NXHX-TRANSACTION-STATE-0003`. The unexpected entry and journal remain in
place. Recovery does not overwrite, delete, merge, or adopt that file even if
other paths could be restored safely. Inspect the digest evidence and use the
separate explicit repair or ownership-transfer workflow.

Transfer transactions record manifest ownership independently from live-file
rollback state. Adoption is ownership `missing → digest` while the file remains
`digest → digest`; repairing a local edit is ownership
`generated → generated` while the file moves `modified → generated`.
Manifest-artifact verification uses ownership digests, while staging, rollback,
and recovery use file digests. This separation preserves exact local bytes on a
failed repair without treating those unreviewed bytes as owned output.

## Stable diagnostic families

- `NXHX-TRANSACTION-LOCKED-0001`: active, unprovable, or malformed lock.
- `NXHX-TRANSACTION-JOURNAL-0002`: malformed or inconsistent journal/artifacts.
- `NXHX-TRANSACTION-STATE-0003`: live bytes or modes match no authorized state.
- `NXHX-TRANSACTION-STAGING-0004`: staging or backup creation failure.
- `NXHX-TRANSACTION-FORMAT-0005`: formatter failure or non-idempotence.
- `NXHX-TRANSACTION-SYNTAX-0006`: invalid formatted TypeScript/TSX.
- `NXHX-TRANSACTION-RECOVERY-0007`: unsafe or changed recovery control state.
- `NXHX-TRANSACTION-VALIDATION-0008`: validation failed after exact rollback.
- `NXHX-TRANSACTION-FILESYSTEM-0009`: atomic I/O or durability failure.

Focused evidence is available through:

```sh
npm run test:publication
```

The corpus injects crashes after journal phases, every live output mutation,
the manifest rename, every rollback mutation, and commit. It also proves
formatter failures preserve sentinels, unchanged inode/timestamp identity,
validation rollback including file modes, safe refusal of unexpected bytes,
published-state validation recovery, stale-lock rules, and concurrent
publisher exclusion.
