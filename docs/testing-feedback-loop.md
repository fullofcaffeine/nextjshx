# Testing feedback loop

This document records the first safe testing-loop optimization increment. It
makes the smallest relevant checks easy to run and removes repeated CLI
compilation, while the existing clean CI and release evidence stays intact.
Affected-test selection is deliberately in observation mode: it explains what
it would run, but it does not yet skip any required pull-request job.

## Why this work exists

A normal framework change should fail close to the code that caused it. Before
this increment, the main harness was one sequential chain of 32 scripts, the
root suite expanded to roughly 43 leaf commands, and several fixtures rebuilt
the same CLI TypeScript sources independently. Contributors could run a
specific script if they already knew its name, but the repository had no
validated map from a changed file to its semantic test owner.

The practical result was slow or uncertain feedback:

```text
changed file
  -> hand-maintained path rules or broad npm test
  -> repeated setup
  -> a useful failure, often later than necessary
```

The new path is:

```text
changed file
  -> validated ownership manifest explains the relevant lanes
  -> focused or semantic-smoke execution
  -> full clean Next/browser/compatibility proof remains in CI and release
```

The word **lane** means one stable test owner with a bounded command, timeout,
evidence type, environment, and reproduction command. A lane is not a claim
that its check replaces another layer. For example, a snapshot lane cannot
stand in for strict TypeScript or a real Next production build.

The suite uses a compiler-aware testing trophy because the highest-value bugs
usually occur between Haxe, Genes, generated TypeScript, ownership publication,
and Next. Unit tests keep isolated logic fast but cannot prove those
agreements; browser-heavy testing would find the same problems later and at
greater cost. Static/compiler checks are therefore broad, real cross-tool
integrations are the largest executable layer, and a smaller set of
production-real E2E journeys proves user-visible runtime behavior. The
[testing strategy](testing-strategy.md#why-the-suite-uses-a-compiler-aware-testing-trophy)
contains the full rationale.

## Current topology

The machine-readable authority is
[`config/test-lanes.json`](../config/test-lanes.json), validated by
[`schemas/test-lanes.schema.json`](../schemas/test-lanes.schema.json). The
manifest records 60 stable lanes and their path ownership, reverse
dependencies, evidence, feedback ring, cost, environment, isolation,
preparation, timeout, artifacts, and claim status.

Before this increment:

- `test:harness` directly chained 32 scripts in one long command;
- root `npm test` expanded to about 47 script references and 43 leaf commands;
- `test:harness` ran `showcase-ui`, then root `npm test` ran it again through
  the complete showcase owner;
- seven focused fixture runners rebuilt the CLI, and the tooling lane built it
  again;
- the ordinary CLI build compiled 58 runtime files and 30 CLI test files even
  when a fixture only needed `.tmp/src/cli.js`;
- pre-commit used a separate regular expression and several special cases,
  which omitted the maintained Field Atlas showcase;
- the governance workflow had 14 effective jobs after matrix expansion and no
  observed affected-lane plan or scheduled full backstop.

After this increment:

- `test:harness` reads the manifest and reports one result per stable lane;
- the duplicate harness-owned `showcase-ui` run is removed, while
  `test:showcase-ui` and full `test:showcases` remain independent commands and
  main/nightly/release evidence;
- fixture runners ask one fingerprinted helper for the runtime CLI build;
- CLI test lanes ask the same helper for one build that includes the tests;
- every standalone runner still prepares itself correctly;
- pre-commit derives fast affected checks from the same manifest;
- CI publishes an observed plan while every existing required job still runs;
- main pushes and the scheduled workflow remain full current-primary
  backstops, and release lanes remain declared from the start.

The later behavior-first convergence does not move or remove any of those
lanes. It adds independent product-surface scorecards and maintained-example
tiers to the same manifest. Explain output now lists the surfaces exercised by
each selected and omitted lane, so affected testing remains about semantic
owners and claims rather than path proximity alone.

## Feedback rings

The rings describe when evidence is useful; they do not rank its truth.

| Ring | Use | Current contract |
|---|---|---|
| R0 focused/editor | Prove one semantic owner while coding. | `npm run test:focused -- --id <lane-id>` |
| R1 local smoke | Catch cheap cross-layer failures before remote CI. | `npm run test:smoke`; target 15–30 seconds where practical |
| R2 required PR primary | Prove one clean real Haxe-to-Next vertical path. | Node 20.19.3 + Turbopack stable fixture remains required |
| R3 affected extended | Run expensive behavior selected by a known owner. | Observation only until selector confidence is earned |
| R4 main/nightly full | Run every current-primary owner and audit omissions. | Full on main and daily scheduled governance workflow |
| R5 release/claim | Prove every public compatibility cell from clean inputs. | Both claimed Node lanes and both bundlers remain required |

Initial latency objectives are service goals, not current claims: focused tests
should usually finish in 15–30 seconds; local smoke should commonly stay under
2–3 minutes; the required PR path should first fail within 4–8 minutes and
finish within 12–15 minutes; the full main/nightly critical path should
initially stay within 30–45 minutes. Historical data must justify changes to
those budgets.

## Smallest useful commands

Validate the topology itself:

```sh
npm run test:loop:validate
npm run test:loop:self
```

Ask why a change maps to particular owners:

```sh
npm run test:loop:explain -- --staged
npm run test:loop:explain -- --base <merge-base> --head HEAD
```

Run one owner or the selected staged owners:

```sh
npm run test:focused -- --id route.patterns
npm run test:changed -- --staged
```

Run the local semantic smoke:

```sh
npm run test:smoke
```

The smoke validates the manifest and failure-propagation self-test, compiles a
positive Haxe fixture, requires the exact negative diagnostic, checks a
deterministic adapter plan, runs strict generated TypeScript, and executes
cheap codec/runtime assertions. It intentionally does not run a production
Next server or browser. The required remote primary lane supplies that real
vertical evidence.

Volatile plans and lane results are written below
`.nextjshx/testing/`, which is ignored. Each result records the commit and
dirty-patch identity, selection reason, Node/platform/profile/bundler,
execution time, outcome, timeout and retry state, prepared-build state,
expected artifacts, and reproduction command. CI also prints a concise job
summary.

## Selection safety

The selector uses transparent path patterns and declared reverse dependencies.
For every path it lists:

- selected lanes and the exact matching owner or expansion reason;
- omitted lanes and why no rule selected them;
- always-run sentinels;
- declared Node, bundler, and output-profile cells;
- a local reproduction command.

Changes to the selector, manifest, schema, package/lock/toolchain identities,
support matrix, workflows, hooks, security policy, core publication/process
behavior, or an unknown path expand to full validation. The selector cannot
validate itself by choosing a narrow subset.

Ordinary prose may use a docs-only fast path. Testing strategy, compatibility
claims, architecture decisions, agent/contributor instructions, security and
publication policy, schemas, generated docs, and fixture contract READMEs are
not ordinary prose; their owner rules still run.

Required affected-only execution needs at least 30 varied observed runs and 14
days of representative changes with no unexplained misses. A miss resets the
confidence window for that ownership area. Until that gate passes, CI's plan is
advisory and the old full required coverage remains active.

## Prepared CLI build

`tools/cli/scripts/ensure-build.mjs` has two precise modes:

- `runtime` compiles only `src/**/*.ts`, which is enough for fixtures that call
  `.tmp/src/cli.js`;
- `test` compiles runtime and `test/**/*.ts` once for CLI test lanes.

The helper hashes the relevant CLI sources, test sources when applicable,
root and CLI package metadata, lockfile, TypeScript package identity,
tsconfigs, build mode, platform, architecture, and exact Node version. It
accepts prepared output only when that fingerprint, the required files, and
the complete emitted source/test tree digest match. Missing `.tmp`, a deleted
or modified CLI output, or any relevant input change forces a rebuild. No
environment variable can simply declare stale output valid.

The runtime and test builds use the same strict TypeScript settings. Splitting
the inputs removes unnecessary test compilation from fixture-only work; it
does not weaken checking.

## Baseline measurements

Local measurements were collected at commit
`4c4b03e8b160595f4d035968f8fe80657620c06f` on macOS 15.4, Apple M2 Pro,
32 GiB RAM, Node 20.19.3, Haxe 4.3.7, Genes 1.41.0, TypeScript 6.0.2, Next
16.2.12, and React 19.2.7. These are small samples, so this table reports each
sample or range rather than inventing p50/p95 values.

| Measurement | Samples | Result |
|---|---:|---|
| Old combined CLI build | 3 | 2.41 s cold; 2.11 s and 2.20 s subsequent; emitted 58 runtime + 30 test files |
| New runtime CLI build | 1 cold, 1 hit | 2.12 s cold; 0.14 s verified hit |
| New CLI test build | 1 cold, 1 hit | 2.33 s cold; 0.14 s verified hit |
| CLI stale/miss test | 3 | 13.91–17.85 s for clean, hit, deletion, modified-output, runtime-source, and test-source cases |
| Local semantic smoke | 2 | 27.91–29.74 s total; all seven lanes passed |
| Pre-push gate | 1 before, 1 after | 26.40 s before; 26.15 s after; intentionally unchanged evidence |
| New manifest-driven harness | 1 | 33 lanes; 638.85 s summed sequential execution |
| Complete root `npm test` | 1 | 1,025.01 s; mixed adoption, primary fixture, Todo E2E, and every showcase passed |

One recent hosted governance run (`30490426695`) completed in about 14 minutes
21 seconds. Its baseline harness step took about 13 minutes 53 seconds;
showcases took about 4 minutes 35 seconds of execution, Todo about 2 minutes 14
seconds, and stable fixture cells spent roughly 35–51 seconds building plus
17–46 seconds smoking. This is one run, not a latency distribution. Forward
lane-result collection is the source for future p50/p95 and selector-yield
decisions.

Future portfolio reviews also record unique actionable failures, escaped
defects by surface, diagnosis time, and browser/E2E discoveries converted into
focused deterministic regressions. The testing-trophy ranges are reviewed per
surface and by stable behavior owner; the number of lane records is not used as
a proxy ratio because several lanes intentionally cross more than one layer.

## Reliability, caches, and artifacts

Deterministic failures are never retried into green. Playwright remains at zero
automatic retries. Each lane has a timeout, a separate process group, and
TERM/KILL cleanup. The harness self-test deliberately observes a nonzero child
and a timeout so a runner regression cannot report them as success.

A cache or prepared build only saves work; a miss must still produce a correct
run. Generated adapters, `.next`, plans, CLI output, and snapshots are never
the sole proof of a clean claim. Main/nightly/release retain cold, real Haxe,
strict TypeScript, Next build, runtime/browser, package, and security owners as
applicable.

Useful failure evidence includes the observed plan, per-lane result records,
generated-tree differences, strict TypeScript output, Next logs, drift reports,
and browser traces/screenshots. These artifacts may be reused only when the
source, profile, toolchain, and configuration identity matches exactly.

## Local hooks and remote ownership

Pre-commit owns complete staged-file safety, Haxe formatting, local-path and
whitespace checks, JSON validation, staged secret scanning, manifest
validation, and reliably fast affected lanes. It does not start production
Next servers or browsers.

Pre-push still scans full Git and decoded Beads history, then runs the measured
medium `test:prepush` gate. Incremental history scanning remains deferred until
a fail-safe range algorithm is proven; speed is not a reason to weaken secret
prevention.

Clean Node/Next/bundler matrices, browser suites, complete showcases, full Todo
E2E, canary drift, and release/consumer proof remain remote by default. Every
lane still has a bounded local reproduction command in the manifest.

Maintained examples remain executable QA throughout this split. Their Haxe
source compiles, generated output is strictly checked, production builds run,
and browser-facing behavior is exercised with zero-retry Playwright. Focused
selection changes when that evidence runs, never whether the claim must
eventually be proved.
