# Genes generator-orchestration decision

## Outcome

NextJsHx and WordPressHx have independently built the same lower-level tooling:
both safely replace a generated file set, recover after a process crash,
serialize rebuilds, discover Haxe inputs, and manage a project-local Haxe
compiler server. Those mechanisms should be implemented once in the genes
repository and consumed by both frameworks.

The reusable code must be a separate host-tooling surface, provisionally called
`genes.tooling`. It must not be added to the compiler's existing
`genes.OutputTransaction`, and it must not decide what either framework owns.
The compiler transaction protects one compiler invocation. The host transaction
protects a complete application generation across processes and may include
compiler output, framework adapters, declarations, maps, and a framework
manifest.

This report accepts three upstream extraction families:

1. a crash-safe generated-artifact transaction kernel;
2. HXML inventory, watch reconciliation, and single-flight rebuild primitives;
3. an owned Haxe wait-server lifecycle.

It rejects a shared framework ownership manifest, shared adoption policy,
shared post-generation validators, a shared definition of “last good,” and
shared user-facing diagnostic codes. Those are host policy, even when their
implementations use the generic kernels.

The decision is based on these reviewed revisions:

- NextJsHx `f2decdcb6b346fbe640dce77382f8f0b26575da2`;
- genes-ts `79fa0ead5058c1f1b6c19d047559a4681b47fdcc`;
- WordPressHx `50d4b7fc025e020e8fed01de94af13ab8ed98844`.

## Implementation status

The original review made no implementation or downstream dependency change.
The accepted generic mechanisms now exist in the genes repository as the
separately versioned `@genes-ts/tooling` package:

- `@genes-ts/tooling/artifacts` publishes and recovers exact authorized
  generated-file transitions;
- `@genes-ts/tooling/hxml` inventories explicit HXML inputs;
- `@genes-ts/tooling/watch` reconciles native events with authoritative
  snapshots;
- `@genes-ts/tooling/loop` serializes bursty rebuild requests and guarantees
  one newest-state follow-up;
- `@genes-ts/tooling/haxe-server` owns a compatible project-local Haxe
  `--wait` lifecycle with direct-compile fallback.

Version `0.1.0` and its framework-neutral conformance vectors are available in
the immutable GitHub Release archive recorded in
[Genes tooling distribution](genes-tooling-distribution.md). The package is not
published to the npm registry.

NextJsHx has chosen to delay that npm release. It now installs the exact,
checksum-verified `.tgz` archive from the GitHub Release. The first downstream
integration can now migrate to shared primitives without copying their source.
See [Genes tooling distribution](genes-tooling-distribution.md) for the exact
package identity and source rules.

## Why this work exists

A framework development command normally performs more than one write. For
example, one Haxe edit may produce implementation modules, source maps, public
declarations, framework convention adapters, and an ownership manifest. A
process can exit after replacing some of those files but before replacing the
rest.

genes already prevents a caught emitter or filesystem error from leaving one
compiler invocation half-published. Its
[`OutputTransaction`](https://github.com/fullofcaffeine/genes-ts/blob/79fa0ead5058c1f1b6c19d047559a4681b47fdcc/src/genes/OutputTransaction.hx) stages the
compiler-owned modules, records the previous bytes in memory, moves its
manifest last, and rolls back before the same process exits. That is the right
compiler contract.

It cannot recover after the process is killed, because the rollback state
exists only in memory. It also cannot coordinate files that belong to a host
framework rather than the compiler. NextJsHx therefore has a durable
[`publisher`](../tools/cli/src/publisher.ts) and
[`publication journal`](../tools/cli/src/publication-journal.ts). WordPressHx
independently has
[`ArtifactOwner`](https://github.com/fullofcaffeine/wordpresshx/blob/50d4b7fc025e020e8fed01de94af13ab8ed98844/packages/cli/src/wordpresshx/cli/ownership/ArtifactOwner.hx)
and an exact
[`OwnershipContract`](https://github.com/fullofcaffeine/wordpresshx/blob/50d4b7fc025e020e8fed01de94af13ab8ed98844/packages/cli/src/wordpresshx/cli/ownership/OwnershipContract.hx).
Both implementations persist enough hashes, modes, staged bytes, backups, and
phase information for a later process to finish or roll back without guessing.

Keeping two security-sensitive implementations has a practical cost. Every
fix for a symlink race, malformed journal, stale lock, mode mismatch, or second
crash must be independently designed and proven. Gutenberg and another
Haxe-to-JavaScript or Haxe-to-TypeScript host would otherwise create a third
copy. A generic genes tooling kernel gives all hosts one recovery algorithm and
one adversarial conformance corpus while leaving their product behavior
independent.

## Smallest useful mental model

```text
Haxe compiler
  -> private compiler output transaction
  -> complete private staged generation

framework policy
  -> authorizes exact live-path transitions and validators
  -> produces a framework manifest as the commit marker

genes.tooling transaction kernel
  -> verifies the authorized prior and staged states
  -> durably journals, publishes, and recovers the transition
  -> moves the framework commit marker last
```

“Commit marker” means the one file whose new bytes declare that the new
generation is authoritative. In NextJsHx it is the NextJsHx ownership
manifest. In WordPressHx it is the WordPressHx ownership manifest. The generic
kernel treats it as an exact file state; it does not interpret its framework
fields.

## Duplicated and distinct invariants

| Concern | genes compiler today | NextJsHx host today | WordPressHx host today | Decision |
| --- | --- | --- | --- | --- |
| Complete private staging | Stages compiler artifacts under one output root | Stages formatted adapters, manifests, and other planned output | Requires a complete caller stage matching its next manifest | Keep compiler staging in `OutputTransaction`; provide generic host staging verification |
| Exact file state | Reads prior bytes in memory | Records SHA-256, mode, ownership digest, and absent/present state | Records SHA-256, size, and absent/present state | Extract a generic closed `FileState` and exact comparison |
| Manifest-last publication | Moves the genes compiler manifest last | Moves the NextJsHx ownership manifest last | Moves the WordPressHx ownership manifest last | Extract a host-agnostic commit-marker operation |
| Caught-error rollback | Restores in-memory backups | Restores journal-bound backups | Restores journal-bound backups | Keep the compiler rollback; extract the durable host rollback |
| Process-crash recovery | Not provided | Later process commits a validated published state or rolls back | Later process finalizes a complete next state or rolls back | Extract one fail-closed recovery state machine |
| Second crash during recovery | Not provided | Recovery phase is journaled and resumable | Recovery reconstructs exact live/backup state | Shared corpus must prove interruption at every recovery mutation |
| Exclusive writer | Caller must serialize writers | Project-scoped exclusive lock with cautious dead-PID recovery | Project-scoped lock bound to project identity and journal | Extract the lock primitive and conservative recovery rules |
| Path confinement | Rejects traversal and existing symlink escape below compiler root | Rejects traversal, nonportable collisions, unsafe control paths, and symlinks | Rejects traversal, case collisions, root changes, and symlinks | Extract portable relative-path and no-follow checks; hosts still supply allowed roots |
| Native collision policy | Owns only its exact compiler manifest set | New unowned App Router or configured output paths block publication | New unowned artifact paths block publication | Hosts decide whether a path is authorized; the kernel only enforces the supplied prior state |
| Adoption and release | Not provided | Next-native adoption, release, repair, and target transfer rules | Exact `adopt-generated` relinquishment | Keep local; these operations change framework ownership semantics |
| Validation | Compiler emitters define their own valid files | Formatter, TS syntax, Next typegen, strict TypeScript, and Next build policy | Declared stage validators plus WordPress package/profile validation | Hosts validate; the kernel accepts only an authorization token bound to the exact plan |
| Last-good generation | Not a compiler concept | Retains the last Next-validated manifest and one Next dev process | Retains the last framework-validated manifest and reconciles services | Keep local; the kernel reports committed/rolled-back state but cannot define “good” |
| HXML inputs | Compiler consumes HXML indirectly through Haxe | Parses nested HXML, classpaths, resources, and libraries for watching | Derives an authenticated effective input graph and watch rules | Extract HXML inventory with caller-provided library and environment resolution |
| Watch delivery | Not provided | Native events plus polling reconciliation and source/identity causes | Portable nonrecursive subscriptions plus effective-input refresh | Extract reconciliation and single-flight scheduling; hosts classify inputs |
| Haxe wait server | Compiler can be called with a server | Owns, probes, replaces, and stops a project-local server | Owns a compatibility-bound lease and falls back to direct compilation | Extract an owned server lifecycle parameterized by compile/probe commands and compatibility digest |
| Diagnostics | Compiler diagnostics are compiler-owned | `NXHX-*` codes and remediation | `WPHX-*` codes and remediation | Kernel returns closed failure facts; each host maps them to its own stable envelope |

## Accepted upstream surface

### 1. Durable artifact transaction

The first extraction should be a small filesystem engine, not a generator
framework. A conceptual API is:

```haxe
typedef FileState = {
  final sha256:String;
  final sizeBytes:Int;
  final mode:Int;
}

enum ExpectedFileState {
  Absent;
  File(state:FileState);
}

typedef ArtifactTransition = {
  final path:PortableRelativePath;
  final prior:ExpectedFileState;
  final next:ExpectedFileState;
  final stagedPath:Null<PortableRelativePath>;
}

typedef PublicationPlan = {
  final projectRoot:RealDirectory;
  final transactionRoot:PortableRelativePath;
  final commitMarker:ArtifactTransition;
  final artifacts:Array<ArtifactTransition>;
  final authorizationDigest:Sha256;
}

interface DurableArtifactPublisher {
  function publish(plan:PublicationPlan):PublicationOutcome;
  function recover(
    root:RealDirectory,
    transactionRoot:PortableRelativePath,
    admitIntended:PublicationPlan->Bool
  ):
    RecoveryOutcome;
}
```

The names are provisional. The `admitIntended` callback is the host's recovery
oracle: it may approve a complete intended state after rerunning the required
framework validation. If it does not approve, the kernel rolls back. The
operational boundary is:

- the caller supplies a complete, deterministic set of exact transitions;
- every live and staged state must match before the first live mutation;
- paths must remain beneath a real project root without symlink traversal;
- the engine creates an exclusive lock and a canonical durable journal;
- old live files move to exact backups and new files move from private stage;
- the commit marker moves last;
- recovery offers only a complete intended state to the host's validation
  oracle and commits it only when the host approves; otherwise it restores the
  exact prior state;
- unexpected live, staged, backup, lock, or journal state stops recovery
  without modifying the ambiguous path.

The `authorizationDigest` binds the transition plan to host preflight. It is
opaque to genes tooling. NextJsHx computes it from its closed plan, ownership
manifest, configured output roots, and validators. WordPressHx computes it from
its own contract. The kernel verifies identity; it does not decide whether the
authorization was reasonable.

The package should expose structured failure facts such as
`UnexpectedLiveState(path)`, `SymlinkTraversal(path)`,
`MalformedJournal(field)`, `ActiveWriter`, and `RecoveryConflict(path)`.
NextJsHx maps those facts to `NXHX-*`; WordPressHx maps them to `WPHX-*`.
User-facing wording, documentation identifiers, exit codes, and suggested
framework commands do not belong upstream.

### 2. HXML inventory, watch reconciliation, and single-flight rebuilding

The current NextJsHx
[`watch-inputs.ts`](../tools/cli/src/watch-inputs.ts) contains two separable
jobs:

1. parse HXML and resolve nested HXML, `-cp`, `-resource`, and `-lib` inputs;
2. add NextJsHx package/workspace identities and turn the inventory into native
   watchers and polling snapshots.

Only the first job and the generic reconciliation machinery belong upstream.
The API should accept:

- one or more entry HXML files;
- an initial working directory;
- an explicit environment-value resolver;
- a library-to-HXML resolver;
- caller-provided exact inputs and tree inputs;
- caller-provided ignored roots and bounded file/byte budgets.

It should return normalized HXML files, classpaths, resources, library names,
and a deterministic identity. It must not know `next.config.*`,
`wordpress-hx.json`, an App Router root, a plugin root, or a package manager.

The watcher should combine native notifications with a polling snapshot so a
coalesced or lost operating-system event cannot lose an edit. The scheduling
primitive should generalize NextJsHx
[`SerializedDirtyLoop`](../tools/cli/src/dev-loop.ts): it accepts a
caller-defined cause and an associative merge function, permits at most one
active run, and guarantees one newest-state run after changes received during
the active run. NextJsHx may merge `source < identity`; WordPressHx may merge
changed path sets. The generic primitive must not encode either vocabulary.

### 3. Owned Haxe wait server

The server primitive owns only a Haxe `--wait` process that it started. It
should:

- reserve loopback capacity without a fixed shared port;
- bind a lease to the real project identity and a caller-provided
  compatibility digest;
- probe readiness within a bounded interval;
- reuse only its compatible live process;
- fall back to a caller-provided direct compile path when the server is
  unavailable;
- restart after an owned server dies;
- stop only the owned process, escalating from graceful termination after a
  bounded timeout;
- remove a lease only when its exact bytes still match.

The caller decides which HXML/config/toolchain inputs form the compatibility
digest and how a failed compile is presented. NextJsHx retains ownership of its
Next dev server. WordPressHx retains ownership of its browser, PHP, WordPress,
and reload services.

## Package boundary

These APIs should live in the genes repository but outside compiler internals:

```text
genes compiler core
  genes.OutputTransaction
  genes emitter, maps, declarations, modules, JSX

genes host tooling
  genes.tooling.artifacts
  genes.tooling.haxe
  genes.tooling.loop
```

A separately versioned ESM package is the practical consumption target because
NextJsHx's CLI is TypeScript while WordPressHx's CLI is authored in Haxe and
compiled to JavaScript. npm can install this package from the npm registry or
from an exact `.tgz` archive. NextJsHx will use a checksum-verified GitHub
archive for the first integration and defer the registry publication.

The host-tooling kernel is currently TypeScript. The generic Haxe-authored
publication primitive is implemented in
[genes-ts PR #65](https://github.com/fullofcaffeine/genes-ts/pull/65): matching
`@:genes.moduleFunction` and `@:expose` publish one genuine typed ESM function
through its owner and compilation root. The compiler capability is released.
Until NextJsHx pins the reviewed tooling archive, consumers must not depend on
private generated paths or copy a half-private runtime API.

Putting this code directly in `genes.OutputTransaction` would give the compiler
project locks, durable host journals, host recovery commands, and framework
manifest concerns it does not need. It would also make a compiler invocation
responsible for paths it did not emit. Keeping a separate package preserves the
compiler's narrow failure-atomic contract.

## Standard development-loop contract

The shared package standardizes lifecycle mechanics, not one framework CLI.
Every consumer should still expose the familiar commands for its host:

| User intent | Generic Genes/tooling work | Host-owned work |
| --- | --- | --- |
| `dev` / watch | inventory HXML, reconcile edits, merge causes, serialize compiles, reuse an owned compatible Haxe server, publish one authorized generation | run the Next, Gutenberg, or other framework development service; retain last-good admission and host diagnostics |
| `typecheck` / check | compile the selected Haxe/genes profile and report structured compiler lifecycle facts | run framework and ecosystem oracles such as Next type generation, strict TypeScript, React lint, or WordPress package checks |
| production `build` | perform one deterministic compile/generation and durable publication using the configured output language and intent | run the framework's production compiler, validators, packaging, and deployment preparation |

The next generic layer should compose the existing primitives into a small
session and event protocol. It must not introduce another watcher, server
manager, publisher, or framework-neutral command that secretly owns a Next or
WordPress process.

Fast watch behavior is part of the contract:

- source-only edits reuse one compatible project-scoped Haxe compilation
  server;
- compiler, HXML, classpath, define, toolchain, or output-profile identity
  changes restart or invalidate that server;
- bursts never create overlapping compiles, and an edit during compilation
  guarantees one rerun from newest state;
- a dead or unavailable owned server falls back to a bounded direct compile
  without adopting a foreign process;
- only a complete authorized generation reaches the live tree.

Performance must be measured rather than inferred from the presence of
`--wait`. The shared benchmark corpus should record cold direct compilation,
warm compiler-server compilation, no-op and one-file edits, edit-to-ready
p50/p95, burst and edit-during-compile behavior, server recovery, generated
file churn, and time spent in Haxe typing, genes planning/lowering/emission,
publication, and host validation. NextJsHx should compare the complete
Haxe-edit-to-Next-ready loop with an equivalent vanilla TypeScript Next app;
other hosts should provide their own native JavaScript/TypeScript comparison.

## Compiler-output coherence

The host transaction must never take over the compiler's private output
protocol. The correct sequence for a complete generation is:

1. choose a private generation root;
2. invoke Haxe with the released request-local `genes.output` capability
   pointing into that root;
3. let `genes.OutputTransaction` publish a coherent compiler tree inside that
   private root;
4. render and validate all host-owned artifacts in the same private generation;
5. let the framework authorize exact live transitions;
6. pass that closed transition plan to the durable host publisher;
7. publish the framework ownership manifest as the commit marker.

If Haxe or the genes compiler fails, the live application is untouched. If the
host process crashes, the durable journal contains every live transition,
including the compiler files. This is required for isolated output-profile
comparison and switching; pointing the compiler directly at the live root and
then journaling only framework adapters would retain a split transaction.

## What remains framework-owned

### NextJsHx

NextJsHx keeps:

- App Router target calculation, path groups, slots, interception, special
  files, route handlers, metadata, and convention export shapes;
- the generated-output manifest and its NextJsHx protocol/schema;
- allowed output roots/files and native-versus-generated collision policy;
- `adopt`, `release`, `repair`, and `clean` semantics;
- formatting, TypeScript syntax checks, Next type generation, strict
  TypeScript, React lint, Next build, and browser validation;
- the definition and reporting of the last Next-validated generation;
- Next dev-server ownership and reload/restart behavior;
- `NXHX-*` diagnostics and recovery commands.

### WordPressHx

WordPressHx keeps:

- plugin, theme, Gutenberg, PHP, asset, package, and profile output policy;
- its manifest schema, output roots, validator identities, and migration rules;
- `adopt-generated`, clean, packaging, service reconciliation, and reload
  policy;
- the definition and reporting of its last validated generation;
- `WPHX-*` diagnostics and remediation.

### genes compiler

The compiler keeps:

- the exact-output owner identity and stale compiler-file manifest;
- private emitter staging and caught-error rollback within one compile;
- TypeScript/JavaScript/JSX output semantics, declarations, and source maps;
- compiler diagnostics.

## Shared conformance corpus

An upstream extraction is not accepted merely because both frameworks can call
it. One versioned corpus must drive the upstream kernel and both downstream
consumer adapters.

### Artifact transaction vectors

The corpus must cover:

- create, replace, remove, unchanged, and commit-marker-only transitions;
- first generation and replacement of an existing generation;
- exact bytes and Unix modes;
- missing, extra, modified, or undeclared staged files;
- unowned live collision and a live path changing after preflight;
- lexical traversal, absolute paths, portable case collisions, symlinked
  project root, parent, destination, stage, backup, lock, and journal;
- active writer, dead same-host writer, foreign or unauthenticated lock,
  orphan lock, orphan journal, and malformed canonical journal;
- process exit after journal preparation, after each backup/publication
  operation, after commit-marker publication, and during cleanup;
- a second process exit during each rollback mutation;
- complete intended state finalization, partial state rollback, unexpected live
  state refusal, and idempotent terminal recovery;
- filesystem/device assumptions, permission failure, and control-path
  collision.

NextJsHx already has focused crash, rollback-crash, symlink, lock, and
collision cases in
[`publication.test.ts`](../tools/cli/test/publication.test.ts).
WordPressHx has the same categories in
[`test-production.py`](https://github.com/fullofcaffeine/wordpresshx/blob/50d4b7fc025e020e8fed01de94af13ab8ed98844/scripts/ownership/test-production.py)
and
[`test-contract.py`](https://github.com/fullofcaffeine/wordpresshx/blob/50d4b7fc025e020e8fed01de94af13ab8ed98844/scripts/ownership/test-contract.py).
The first upstream task should normalize these cases into shared input and
expected-outcome vectors, then run the same vectors through:

1. the genes tooling reference implementation;
2. the NextJsHx adapter;
3. the WordPressHx adapter.

Framework-only tests remain in their repositories.

### Haxe tooling vectors

The shared HXML/watch/server corpus must cover:

- nested HXML and changing `--cwd`;
- quoted, escaped, commented, missing, and malformed arguments;
- classpaths, resources with aliases, libraries, and environment expansion;
- cycles and duplicate input normalization;
- a library resolver returning no result or an unsafe result;
- edits delivered by native events, polling only, and both;
- an edit during an active compile;
- burst coalescing and caller-defined cause merging;
- registration-gap reconciliation;
- ignored roots, symlinks, missing roots that later appear, and safety budgets;
- compatible server reuse, incompatible digest restart, port reservation
  failure, readiness timeout, unexpected exit, direct-compile fallback, live
  foreign lease, stale exact lease, and bounded shutdown.

The corpus should assert behavior and structured failure kinds, not
framework-specific event names or prose.

## Sequencing and migration

1. Publish shared conformance vectors and a framework-neutral protocol draft in
   the genes repository.
2. Implement the artifact transaction kernel in an isolated genes worktree and
   run the full genes matrix.
3. Add adapters in both NextJsHx and WordPressHx that run the shared vectors
   without changing their public manifest or diagnostic contracts.
4. Migrate one host at a time, preserving byte-for-byte successful output and
   fault-injection behavior.
5. Create a tooling package archive on a GitHub release whose immutable-release
   setting has been verified, then pin its exact source commit, URL, version,
   and checksums before NextJsHx depends on it. An npm registry release is not
   required for this first integration.
6. Only then use the kernel for isolated output-profile comparison and
   transactional profile switching.
7. Extract HXML/watch/loop and compiler-server primitives as separate changes;
   they do not block the artifact transaction and should not enlarge its review
   surface.

Until steps 1–5 pass, both framework implementations remain authoritative.
This report does not permit a temporary NextJsHx-only abstraction to be called
the shared kernel.

## Rejected alternatives

### Move the NextJsHx publisher wholesale into genes

Rejected because its allowlists, ownership digests, repair/adoption operations,
formatting, post-validation, and `NXHX-*` remediation encode NextJsHx policy.
Generalizing names would not generalize the behavior.

### Extend `genes.OutputTransaction` into the host publisher

Rejected because compiler emission and application publication have different
owners and crash lifetimes. The compiler transaction should remain small and
fast; the host publisher must persist recovery authority for a later process.

### Standardize one ownership manifest for all hosts

Rejected because a manifest is a product contract, not just a list of files.
NextJsHx records Next application ownership and transfer rules. WordPressHx
records output roots, validators, profiles, and packaging facts. The generic
kernel needs exact file transitions and an opaque authorization digest, not a
union of framework schemas.

### Put validators into genes tooling

Rejected for framework validators. The kernel may call a generic callback
before commit or during recovery, but Next typegen/build and WordPress
package/profile checks remain host code. A validator cannot be serialized as
durable recovery authority; its exact input/output identity must be represented
by the host authorization digest.

### Define “last good” in the generic loop

Rejected because successful publication is necessary but not sufficient for a
good application generation. The framework decides which static, runtime, or
service checks admit a generation. The generic loop only guarantees serialized
attempts and reports which transaction remained live.

### Share public diagnostic envelopes

Rejected beyond structured kernel failure facts. Users need framework commands,
documentation, exit codes, and remediation. A generic `code/message/details`
record would remove little duplication while coupling public contracts.

## Completion boundary

This evaluation is complete when the report is accepted and implementation
work is represented by upstream/downstream Beads. The extraction itself is not
complete until:

- its public API contains no Next.js, WordPress, Gutenberg, App Router, plugin,
  or framework manifest concept;
- the shared conformance corpus runs against the genes implementation and both
  framework consumers;
- compiler-output transaction tests remain green;
- both frameworks preserve their current successful output and fail-closed
  recovery behavior;
- NextJsHx consumes an exact released genes identity.
