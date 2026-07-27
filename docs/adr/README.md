# Architecture decision records

Accepted ADRs refine the PRD and are normative for their stated scope. Change
an accepted contract with a superseding ADR; do not silently rewrite its
behavior in code, examples, or generated output.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-adapter-first-app-router-integration.md) | Accepted | Adapter-first App Router integration with explicit direct-emission admission criteria |
| [0002](0002-public-namespace-and-app-router-authoring.md) | Accepted | Four-tier public namespace and per-type App Router authoring syntax without a manual route registry |
| [0003](0003-boundary-classification-and-import-graph-enforcement.md) | Accepted | One-module boundary classification, generated cross-boundary refs, targeted DCE retention, and layered Haxe/Next graph enforcement |
| [0004](0004-haxe-native-react-component-authoring.md) | Accepted | Server-default component authoring, inferred client adapters, and caller-sensitive `Component.client()` extension refs without a nominal component runtime |
| [0005](0005-server-function-security-ergonomics.md) | Accepted | Guarded sensitive-action pipeline with request-local application callbacks, operation-scoped authorization witnesses, and mandatory public-result projection without claiming policy correctness |
| [0006](0006-haxe-native-react-hook-authoring.md) | Accepted | Faithful raw React tuples plus allocation-free semantic state/memo intent, explicit dependency packaging, and bidirectional typed Hook publication |
| [0007](0007-reviewed-npm-package-integrations.md) | Accepted | Exact npm/declaration provenance, precise-or-omitted raw and semantic facades, native package ownership, and category-appropriate interop evidence |
| [0008](0008-independent-output-language-and-intent-profiles.md) | Accepted | Independent TypeScript/JavaScript and optimized/reviewable axes, one stable project profile, measured optimization promotion, and an evidence-gated TypeScript-optimized target default |

ADR numbers are stable once committed or referenced by Beads.
