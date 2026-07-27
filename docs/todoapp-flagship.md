# Field Ledger: the flagship NextJsHx application

Field Ledger is the maintained end-to-end example in
[`examples/todoapp-next`](../examples/todoapp-next). It is a normal Next.js App
Router application whose domain, routes, Server Components, Client Components,
Server Functions, cache boundary, and interaction models are authored in typed
Haxe. Next.js still owns React Server Components, routing, type generation,
bundling, development refresh, production rendering, and deployment behavior.

This page is the concise architectural and evidence map. The
[application README](../examples/todoapp-next/README.md) contains the detailed
feature rationale and individual positive and negative examples.

## What the application proves

Field Ledger deliberately combines concerns that isolated compiler fixtures do
not exercise together:

- Haxe-owned App Router layout, list, dynamic detail, metadata, loading,
  not-found, and error boundaries;
- typed route companions, request decoding, JSON responses, Server Functions,
  cache invalidation, and generated boundary references;
- URL-owned search, status, priority, and List/Board state;
- optimistic create, toggle, remove, and reorder flows with rollback, offline
  feedback, and replay-safe retry;
- accessible pointer and keyboard sorting, a command dialog, and a typed
  Recharts planning view with a semantic table; and
- native TypeScript/React seams consumed from Haxe, plus Haxe implementations
  consumed through ordinary Next-compatible TypeScript modules.

It is production-shaped evidence, not a production-ready task service. The
fixture intentionally uses a local TSV store and has no user identity; the
limitations section states what a deployed product must add.

## Architecture and ownership

```text
Haxe domain and application source
  -> Haxe 4.3.7 type checking and NextJsHx macros
  -> genes-ts 1.37.1 split TypeScript/TSX implementation modules
  -> small manifest-owned Next convention/boundary adapters
  -> Next 16.2.12 typegen + strict TypeScript 6.0.2 + Turbopack build
  -> ordinary next start production server and React hydration
```

| Layer | Owner | Why it lives there |
| --- | --- | --- |
| Todo IDs, priorities, records, projections, mutation phases, and decoder results | Haxe application | Closed values and exhaustive switches make invalid states fail before output exists. |
| Page, layout, route, special-file, Client Component, Server Function, and cache intent | NextJsHx semantic Haxe API | Haxe supplies earlier diagnostics and generated references while retaining Next's runtime model. |
| Faithful Next, React, Web, and package contracts | `nextjs.raw.*` | Exact interop remains available when the semantic layer would hide relevant host behavior. |
| `useActionState`/router refresh and the deliberate error trigger | Haxe-authored Hooks over closed raw and semantic bindings | Haxe checks the action tuple, retry transitions, online subscription, refs, callbacks, router refresh, and recovery behavior before generating analyzer-visible TSX. |
| shadcn-style presentation | Source-owned TSX in `@nextjshx/showcase-ui` | shadcn components are application source; Haxe consumes their exact closed prop facades. |
| dnd-kit, nuqs, cmdk, Radix, and Recharts runtime behavior | Exact pinned npm packages | NextJsHx adds checked raw or semantic surfaces without copying the package runtime. |
| App Router filenames, directives, and exports | Generated TypeScript/TSX adapters | Next conventions remain canonical, reviewable, deterministic, and collision checked. |
| Routing, RSC, caching, bundling, hydration, and deployment | Next.js and React | NextJsHx does not introduce a router, client runtime, or server runtime of its own. |

## Where Haxe improves the authoring surface

### A route is a typed destination, not a promoted string

Haxe application code names the route declaration and supplies its exact
parameter record:

```haxe
<Link href={TodoDetailPage.href({id: todo.id})}>{todo.title}</Link>
```

The generated call site looks like handwritten TypeScript:

```tsx
<Link href={`/todos/${encodeURIComponent(todo.id)}`}>{todo.title}</Link>
```

The Haxe version also rejects missing, extra, or wrongly typed parameters. An
arbitrary string cannot be assigned to the nominal route result. Next typegen
then independently checks that the destination exists in the actual route
graph.

### URL state keeps familiar React composition but closes the domain

The semantic nuqs surface accepts the Haxe enum-abstract domain:

```haxe
final status = Nuqs.useQueryState("status", Parsers.stringLiteral([
  TodoStatusFilter.All,
  TodoStatusFilter.Open,
  TodoStatusFilter.Done
], TodoStatusFilter.All));
```

It emits the normal package call with a retained TypeScript literal union:

```ts
const status = useQueryState<"all" | "done" | "open">(
  "status",
  parseAsStringLiteral<"all" | "done" | "open">(
    ["all", "open", "done"],
  ).withDefault("all"),
);
```

The semantic layer removes parser witnesses and stringly setters from
application code. The faithful raw binding remains available for a parser that
cannot be represented by the reviewed closed surface.

### Package keys that TypeScript commonly models as strings stay nominal

The planning projection produces only the two supported numeric series:

```haxe
final chart = StackedBars.create(
  TodoPlanning.project(projection.visible).rows,
  "Open",
  "var(--planning-open)",
  "Filed",
  "var(--planning-filed)"
);

<YAxis type={AxisType.Category} dataKey={StackedBarCategoryKey.Category} />
<Bar dataKey={chart.primary.key} fill={chart.primary.color} stackId="work" />
```

The ordinary emitted TSX uses direct Recharts components and string literals.
Haxe nevertheless prevents the category key from being supplied where a
numeric series key is required and checks the row shape before TSX exists.

### Native boundaries remain visible

A Haxe Client Component obtains a callable action through the generated
boundary rather than importing a server implementation:

```haxe
final mutation = MutationHook.useTodoMutation(
  ServerFunction.ref(TodoActions.create),
  TodoMutationOperation.Create,
  "Intake desk ready.",
  projectDraft
);
```

NextJsHx emits a directive-first native action adapter and a precise client
import. The abstraction removes the unsafe graph edge; it does not hide that a
React Action crosses HTTP, can fail after a commit, and must authenticate and
authorize in a real product.

## TypeScript and JavaScript ecosystem interop

The flagship keeps its application behavior in Haxe while consuming
source-owned ecosystem components through exact checked facades:

- `todoapp.client.MutationHook` authors React 19 action state, transitions,
  online subscription, optimistic replay, retry, and router refresh in Haxe.
- `todoapp.client.FailureRecoveryHook` authors the deliberate one-shot
  error-boundary exercise through semantic Haxe state.
- source-owned shadcn/cmdk TSX components are consumed in HXX through exact
  props, callbacks, children, and focus identities.

The other direction uses generated modules that ordinary Next/TypeScript code
already understands:

- Next convention files import Haxe-authored page, layout, special-file, route,
  cache, action, and Client Component implementations;
- every Client Component adapter starts with `"use client"` and retains its
  exact prop signature; and
- every Server Function adapter starts with `"use server"`, exports named async
  functions, and delegates without business logic.

The reusable [Hook interop guide](react-hooks.md) and dedicated
[Patchbay 06 adoption example](mixed-language-adoption.md) demonstrate native
TypeScript Hooks consumed by Haxe and Haxe-authored generic Hooks consumed
from ordinary TypeScript/TSX without making that interop glue core flagship
behavior.

## Accessibility and product behavior

Field Ledger uses one editorial “field ledger” visual system rather than a
component-gallery dashboard. Its automated production journeys require:

- native landmarks, headings, labelled groups, live mutation/reorder states,
  visible focus, and focus return;
- pointer sorting on desktop and mobile plus dnd-kit's keyboard sensor;
- URL-backed state that survives reload and Back/Forward navigation;
- useful no-match and truly empty states in both List and Board;
- command-dialog keyboard search, selection, Escape dismissal, and mobile
  viewport containment;
- planning SVG focus/description plus a visible semantic table containing the
  same values; and
- reduced-motion styling and no horizontal overflow at 390 by 844 pixels.

Browser page errors, console errors, hydration diagnostics, request failures,
and unexpected HTTP failures fail the test during teardown, even if the main
visual assertion already passed.

## Evidence matrix

| Claim | Blocking evidence |
| --- | --- |
| Haxe owns type checking | Positive compilation plus exact Haxe-negative fixtures for HXX props, Hooks, routes, package keys, decoders, and mutations. |
| Output resembles native Next/React | Deterministic source guards require canonical imports, direct component trees, first-position directives, typed exports, no compiler carriers, and no broad/asserted types. |
| Next compatibility is real | `next typegen`, strict TypeScript with library checking, and the Next 16.2.12 Turbopack production build. |
| Runtime and hydration work | Raw HTTP smoke plus fourteen isolated, one-worker, zero-retry Playwright production journeys. |
| State and cache isolation are deterministic | Every browser journey owns a mode-0700 run directory, mode-0600 TSV, unique run ID, cache key/tag, loopback port, and `next start` process. |
| Failure handling is honest | Malformed HTTP/form data cannot mutate bytes; ambiguous post-commit failures roll back the projection and retry with the same operation identity. |
| Package boundaries are reviewed | Exact npm versions, lock integrity, license, public exports, declaration digest, source ownership, and executable evidence live in `config/package-integrations.json`. |
| A packed consumer works | `npm run test:package-shape` packs, installs offline, strictly type-checks, and executes a clean consumer. |
| Publication is leak checked | Formatter, whitespace, architecture, security-tooling, Gitleaks, npm audit, and decoded Beads-history scanning are all part of `public:preflight`. |

The latest measured command-and-planning client signature is 537,191 raw bytes
and 162,660 gzip bytes across the identified production chunks. The documented
pre-chart command surface was 210,583 raw and 67,114 gzip, so the current chart
delta is 326,608 raw and 95,546 gzip. These are monitored evidence numbers, not
a claim that Recharts is the smallest possible chart runtime.

## Honest limitations

- The TSV store is deterministic fixture infrastructure, not a concurrent
  production database. It provides neither multi-process transactions nor
  durable backup and recovery.
- The app intentionally has no authentication or tenant model. A deployment
  must authenticate and authorize inside every Server Function and Route
  Handler, apply request limits, and scope idempotency to actor and operation.
- The replay receipt demonstrates the protocol but is not atomic with the TSV
  domain write. Production persistence must commit both in one transaction.
- The reviewed Recharts surface omits Tooltip because the pinned public payload
  contains `any`. The visible legend and table are the supported accessible
  alternative; a future tooltip needs a closed upstream or immediately decoded
  boundary.
- The small `app/environment.d.ts` file bridges a Next 16.2.12 generated
  global-`JSX` mismatch to React 19's `React.JSX`. Strict library checking stays
  enabled, so it is a narrow compatibility bridge rather than a general
  suppression.
- Official React lint runs on applicable native/generated boundary fixtures.
  Haxe-authored Hook bodies are primarily checked by Haxe's typed Hook-placement
  diagnostics because the emitted class-method shape is not recognized as a
  normal function component by the linter.
- The current interactive bundle is intentionally feature-rich. Applications
  that do not need charts or command search should not pay for those packages.
- Public preflight must remain fail closed if any decoded Beads history cannot
  be scanned. At the current Beads 1.1.0 pin, upstream issue #4867 prevents
  decoding one migrated history record; repository issue `nxhx-0dg` tracks the
  reviewed upstream fix. This blocker must be resolved, never skipped, before a
  public-release claim.

## Reproduce the evidence

From the repository root:

```sh
npm ci --ignore-scripts
npx --no-install lix download
npm run test:example:todoapp:source
npm run test:example:todoapp:build
npm run test:example:todoapp:smoke
npm run test:example:todoapp:e2e
npm run test:harness
npm run test:package-shape
npm run public:preflight
```

The build must run before smoke or E2E. `npm run public:preflight` is expected
to stop rather than skip a Beads-history record until `nxhx-0dg` is resolved.
Use `npm run example:todoapp:clean` after local inspection to remove only the
example's generated and manifest-owned build output.
