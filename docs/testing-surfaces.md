# Testing surfaces and example tiers

## Why the suite is split this way

NextJsHx combines several products that can fail independently. Haxe can reject
or accept an authored declaration; Genes can emit the wrong TypeScript shape;
the CLI can mishandle ownership; Next can reject a convention module; React can
reject a Hook or boundary; and a browser interaction can fail after every build
step succeeded. One aggregate green result would hide which promise was
actually exercised.

[`config/test-lanes.json`](../config/test-lanes.json) is the machine-readable
authority. Schema v2 records the scorecard owner and archetype; supported and
actually targeted profiles; focused, vertical, runtime, and browser owners;
examples; upstream oracles; adaptations; skips and quarantines; backstop and
release commands; the latest recorded clean proof; and residual risks. The
selector reports these surface IDs without changing which lanes run.

Evidence attribution is reciprocal. A scorecard may cite a lane only when the
lane also names that product surface, and an example may cite a lane only when
the lane names that example. Each required evidence kind points to its concrete
owning lanes. This prevents an accidental edit from attaching Todo's browser
result to the package CLI or shared UI scorecard merely because the evidence
kind is convenient.

Tested profiles use the same rule. Every tested profile or compatibility cell
names one or more reciprocal lanes, and the validator checks their declared
TypeScript profile, Node version, bundler, browser evidence, or pinned
Next/React support identity. Adding the same invented label to both supported
and tested lists is therefore not enough to create a claim.

Schema v1 is intentionally rejected rather than guessed forward: it predates
product surfaces, example tiers, and reciprocal evidence ownership. This is a
repository-internal manifest generated and maintained with the selector, so
the migration is to add the v2 records in the same change; there is no public
v1 consumer format to preserve. Selector plans and per-lane result receipts
retain their own independently versioned schemas.

## Product scorecards

| Surface ID | What it may establish | What it must not borrow |
| --- | --- | --- |
| `haxe-generation` | Haxe/HXX diagnostics, deterministic Genes output, and strict generated TypeScript | the official Haxe target suite or unreleased output profiles |
| `package-cli` | discovery, ownership, publication/recovery, commands, and clean packed consumers | a successful application build as proof that collisions or rollback are safe |
| `next-runtime` | pinned Next typegen, production build, `next start`, HTTP, routing, and cache behavior | browser hydration or an unexecuted Node/bundler matrix cell |
| `react-next-semantics` | Client/Server boundaries, Hooks, Flight values, actions, caching, decoding, and environment containment | unrelated package facades, examples, or output profiles |
| `browser-applications` | user-visible behavior that requires a production browser | compiler, package, or compatibility claims that the browser did not inspect |
| `maintained-examples` | each example's declared compile/build/runtime/browser contract | another example's distinctive behavior |
| `compatibility-matrices` | exact pinned package, declaration, Node, bundler, and profile cells | canary warnings or a different cell's green result |
| `repository-governance` | test topology, selection, failure propagation, and policy safety | any application or framework behavior |

The repository status remains foundation-only and the surfaces are marked
`partial`. A scorecard describes evidence ownership; it does not promote the
public release status. `lastCleanProof: null` is intentional until an exact
commit/run receipt is recorded. A non-null receipt has a closed shape with the
commit, run ID, command, completion time, artifact identity, and SHA-256
digest—an old, partial, or free-form local result must not become a permanent
green badge.

## Maintained-example tiers

| Example | Tier | Distinctive evidence boundary |
| --- | --- | --- |
| Field Ledger (`todoapp-next`) | Flagship application | deep production HTTP and zero-retry Playwright journeys for actions, cache, recovery, persistence, routing, and package composition |
| Patchbay (`mixed-adoption`) | Capability showcase | bidirectional Haxe/native ownership, strict build, React identity, and one production browser path |
| Pelagic Signal (`showcase-landing`) | Capability showcase | minimal Server page → Client Component → Hook and hydration flow |
| Moraine (`showcase-blog`) | Capability showcase | static params, metadata, typed dynamic routes, and not-found behavior |
| Common Ground (`showcase-commerce`) | Capability showcase | typed client graph, cart/filter Hooks, images, and source-owned shadcn behavior |
| Field Atlas (`showcase-field-atlas`) | Capability showcase | trusted MDX, decoded portable content, Recharts typing, and distinctive rendering |
| Shared showcase UI (`showcase-ui`) | Capability showcase | Haxe/HXX and strict-TypeScript component contracts; it is not a standalone browser application |

There are currently no maintained compile-only snippets. If one is added, it
may support only compile/typecheck claims and must not advertise production
Next, runtime, or browser evidence.

The aggregate `showcases.all` lane remains a full backstop, but it does not lend
the four applications' browser checks to the shared UI package. This distinction
is enforced by the example scorecard: `showcase-ui` cites only its own focused
lane.

## Portfolio review

Use the testing-trophy ranges as smell detectors per product surface:

- roughly 50–60% focused deterministic/compiler-contract behavior owners;
- roughly 30–40% real vertical integration/runtime behavior owners;
- roughly 5–10% browser E2E scenarios for browser-capable surfaces.

Do not calculate this from the 60 lane records. Several lanes intentionally
bundle focused, target-check, build, and runtime evidence, so a lane count would
double-count some behavior and hide others. A portfolio review must count
stable behavior owners or scenarios, record unique failure yield and escaped
defects, and explain any deliberate shape outside the ranges.

Static format, lint, type, schema, freshness, workflow-policy, and security
checks form the floor and remain outside the ratio.

## Claim discipline

A surface may advance only from its own executed evidence. If evidence is
moved to another feedback ring, the change must name the new owner, explain why
the claim remains protected, and retain the main/nightly and release backstop.
Caches, prepared output, snapshots, selectors, scorecards, and aggregate badges
never substitute for the real claim-bearing command.
