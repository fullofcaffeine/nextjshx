# Consolidated testing v3 convergence audit

## Decision

The 2026-07-31 consolidated-testing update contains a real incremental layer
for NextJsHx, but it does not require replaying the test-loop refactor merged in
PR #11. The R0–R5 rings, semantic lane manifest, explain mode, fail-safe
selection, prepared CLI builds, full backstops, zero-retry browser policy, and
executable-example gates remain valid.

The missing conclusions were about how evidence is authored and bounded:
record the intended red failure, name an independent oracle, start new
capabilities with one real tracer bullet, assign claims to separate product
surfaces, declare example tiers, and perform a distinct review for high-risk
changes.

## Audit result

| V3 conclusion | State before this change | Disposition |
| --- | --- | --- |
| Concrete behavior formulation | Partial: docs described TDD/BDD, but did not require preconditions, action, result, edge behavior, surface, and claim | Added the compact scenario record to contributor and agent guidance |
| Red-state evidence | Absent as a general rule | Added exact command/failure recording; captured a real two-test red state in Bead `nxhx-bf0` |
| Independent oracle/provenance | Partial: many fixtures named Next, TypeScript, package declarations, or reviewed snapshots as oracles | Added the general anti-circularity rule and explicit scorecard oracles |
| One tracer bullet first | Partial: the stable fixture was already a vertical canary, but new-capability workflow did not require it | Added a framework-capability tracer rule and one testing-topology trace |
| Lowest faithful layer and double lock | Present in practice but implicit | Made the placement rule explicit and retained focused plus real-boundary evidence for high-stack discoveries |
| Trophy portfolio guardrails | Partial: the trophy rationale rejected fixed ratios | Added the 50–60 / 30–40 / 5–10 ranges as per-surface smell detectors, never quotas |
| Executable examples | Satisfied operationally | Added explicit flagship/showcase/snippet tiers and evidence ceilings |
| R0–R5 feedback loop | Satisfied | Preserved unchanged; selector remains observation-only |
| Product-surface scorecards | Absent | Added eight schema-v2 scorecards, reciprocal lane ownership, evidence-specific owners, complete scorecard fields, and surface IDs to selector plans |
| High-risk independent verification | Absent as an explicit phase | Added a distinct review requirement and pull-request record |
| Official Haxe target suite | Intentionally inapplicable | Explicitly remains a Genes-owned claim, not a NextJsHx claim |

## Representative red, oracle, and tracer evidence

The implementation began by extending the schema and adding two negative
semantic tests before adding the cross-reference validator:

```sh
node --test scripts/testing/test-lanes.test.mjs
```

The command exited 1 with 12 passing and 2 failing tests. Both failures were
the intended `Missing expected exception`: a product surface could cite
`missing.surface.owner`, and the shared UI example could advertise browser
evidence absent from its declared lane.

The independent expectation came from the documented product split,
`support_matrix.json`, the existing canonical lane inventory, and the actual
shared UI command—which checks Haxe/HXX, strict TypeScript, and React lint but
does not run a standalone browser app.

After semantic validation was added, 14 of 15 tests passed. The remaining red
test exposed an actual scorecard mistake: shared UI cited the aggregate
showcase lane and therefore borrowed other applications' browser evidence.

The separate verification pass found a deeper sensitivity gap: adding the real
`todo.e2e` lane to `package-cli` or `showcase-ui` still passed because the first
validator trusted the scorecard's own lane list. Schema v2 now requires lanes
to name their product surfaces and examples in return, while evidence-specific
owners and layer groups must agree with those lane-side assignments. Valid but
unrelated lane mutations are explicit negative controls. Profile-owner and
closed-proof negatives bring the focused suite to 24 passing tests.

The tracer is appropriate to the changed product surface:

```text
scorecard JSON -> schema -> reciprocal ownership validator -> selector -> explained surfaces
```

No Next build was added because it cannot observe a scorecard cross-reference
defect. A new NextJsHx framework capability still requires the Haxe → Genes →
strict TypeScript → production Next → runtime/browser tracer.

## Example and claim separation

Field Ledger is the flagship application. Patchbay and the four sites are
capability showcases. Shared showcase UI is a capability showcase at the
compile/type/React-lint level, not a browser application. There are no current
compile-only snippets.

The scorecards prevent these common false conclusions:

- Todo green does not prove showcases, public package exports, canary Next, or
  every server/client capability.
- The aggregate showcase browser run does not give the shared UI package a
  browser claim.
- A stable Turbopack build does not prove webpack or another Node cell.
- NextJsHx Haxe fixtures do not establish general Genes compiler conformance.

## Efficiency and timing

No test lane, ring, CI job, example command, retry rule, backstop, cache, or
prepared-artifact policy changed. Re-running the previous full-suite benchmark
would therefore measure ordinary machine variance rather than an optimization
hypothesis. The focused scorecard tests complete in well under one second on
the audit machine; the existing cold/warm and hosted measurements remain in
[the feedback-loop report](testing-feedback-loop.md).

The next portfolio measurement must count stable behavior owners or scenarios,
not the 60 lane records, because several lane commands intentionally combine
focused, strict-target, build, runtime, and browser evidence. It should report
unique failure yield, escaped defects by surface, diagnosis time, and E2E
discoveries converted to focused regressions.

## Claims

This change broadens no product or compatibility claim. It improves the
traceability and ceiling of existing evidence. Repository status remains
foundation-only, canary remains advisory, selector execution remains
observation-only, and complete clean proof remains owned by main/nightly and
`npm run public:preflight`.
