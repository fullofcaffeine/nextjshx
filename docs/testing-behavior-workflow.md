# Behavior-first testing workflow

## The practical loop

Before changing meaningful behavior, write down what a user, framework, or
consumer should observe. Then prove the smallest faithful test can detect the
missing behavior before implementing it.

Record this compact scenario in the Bead or pull request:

```text
Surface and claim:
Given / preconditions:
When / action or compilation path:
Then / observable result:
Error or edge behavior:
Lowest faithful owner and command:
Expected red reason:
Independent oracle and provenance:
Next broader owner:
Tracer bullet, when this is a new capability:
```

Gherkin is optional. The important part is that the expected behavior and its
owner are understandable before a generated snapshot or browser run exists.

## Choosing the first test

Use the cheapest layer that still contains the failure:

- parsing, normalization, selection, codecs, or state transitions start with a
  focused deterministic test;
- invalid Haxe authoring starts with an exact negative compile fixture;
- generated signatures start with focused generation plus strict TypeScript;
- Next conventions require a real production Next build or runtime owner;
- hydration, navigation, visible mutations, browser history, focus, and
  recovery require Playwright or another real browser observer.

A mock is useful only when the mocked boundary is not the claim.

## Independent expectations

The expected result must come from outside the implementation being tested.
Accepted sources include a public specification, a manually authored minimal
result, a pinned upstream implementation, an invariant, a reviewed golden with
provenance, or a real consumer. Never compute both the actual and expected
value with the production algorithm, and never accept a regenerated snapshot
only because the generator produced it.

For generated source, review the semantic shape and retain strict target or
runtime evidence whenever compilability or execution is part of the promise.

## Completed representative trace: product-surface scorecards

This strategy update used its own real topology gap rather than inventing an
application feature.

**Surface and claim.** Repository testing governance must reject a scorecard
that cites a nonexistent lane, and a maintained example must not advertise an
evidence kind absent from its own declared lanes.

**Given.** The schema already accepted the new scorecard and example-tier
shape, but the semantic validator did not yet connect those records to the
canonical lane list.

**When.** The focused command ran two new negative controls:

```sh
node --test scripts/testing/test-lanes.test.mjs
```

**Intended red result.** The command exited 1 with 12 passing and 2 failing
tests. Both failures were `Missing expected exception`: one for
`missing.surface.owner`, and one where `showcase-ui` advertised browser
evidence not supplied by its declared lane.

**Independent oracle.** The product boundaries come from NextJsHx's documented
architecture and `support_matrix.json`. Lane existence comes from the
pre-existing canonical lane list. The shared UI package's actual package and
focused test commands provide Haxe/HXX, strict TypeScript, and React lint—but
no standalone browser application—so the four showcase applications' browser
runs cannot be borrowed as its evidence.

**First green result.** After adding cross-reference and evidence validation,
the same command initially passed 14 of 15 tests. The remaining red test
exposed a real laundering mistake: `showcase-ui` still cited the aggregate
`showcases.all` lane, which contains browser evidence belonging to other
applications. Removing that borrowed lane made the focused suite green.

**Review red result.** A separate high-risk review then tried a stronger
mutation using a real unrelated lane rather than a missing ID. Adding
`todo.e2e` to `package-cli` or `showcase-ui` still validated because the first
model trusted whichever lane list the scorecard supplied. That was a genuine
test-sensitivity failure, not a documentation concern.

**Final green result.** Schema v2 gives each lane reciprocal `surfaceIds` and
`exampleIds`, and each scorecard names evidence-specific owners. The validator
now rejects both unrelated-lane mutations before considering their evidence.
It also checks focused, vertical, runtime, and browser owner groups, profile
claims, and the v1→v2 boundary. Profile-owner and closed-proof controls bring
the focused suite to 24 passing tests.

**Tracer bullet.** This is testing-topology behavior, so its real vertical path
is:

```text
scorecard JSON
  -> JSON Schema
  -> reciprocal subject and evidence-owner validation
  -> affected selector
  -> machine and human plan containing product-surface IDs
```

A production Next build would add cost without observing this defect. New
framework capabilities still require the separate Haxe → Genes → strict
TypeScript → production Next → runtime/browser tracer described in the testing
strategy.

**Double lock.** Focused tests reject invalid scorecards quickly. The existing
security/governance lane and full main/nightly/release topology validation keep
the repository-level boundary proof. Neither replaces the product tests named
by the scorecards.

The durable work record is Bead `nxhx-bf0`.

## High-risk verification pass

After implementation, review compiler representation, runtime, package
publication, security, migration, ownership, and compatibility-claim changes
as a separate phase. Challenge test sensitivity, oracle independence, missing
negative cases, mocks, selector coverage, scorecard borrowing, and claim scope.
Record each finding and disposition rather than treating a green aggregate as
the review.
