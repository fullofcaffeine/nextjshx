# Field Ledger todo app

This maintained example is NextJsHx production evidence, not a screenshot-only
demo. It turns the individual compiler fixtures into one App Router application
with a Haxe-owned document layout, Server Component list and detail routes,
typed navigation, Haxe Client Components, and native Server Function mutations.
It also composes a generated shared-cache function with a typed JSON Route
Handler, safe request-context reads, native tag invalidation, and a resettable
Haxe error boundary exercised by Playwright against `next start`.

The visual direction is an editorial field ledger: warm graph paper, heavy ink
rules, vermilion priority marks, and a compact information hierarchy. The UI
extends into a source-owned shadcn intake card and per-record actions without
losing the ledger's visual identity. It includes keyboard focus, semantic
landmarks, live mutation feedback, reduced-motion handling, and narrow-screen
layouts.

## Development loop

From the repository root, one command rebuilds the internal CLI and initial
stylesheet, then watches Tailwind and the complete Haxe input graph while one
native Next process owns HMR and Fast Refresh:

```sh
npm run dev --workspace nextjshx-todoapp-example
```

Pass reviewed Next dev flags after the npm separator, for example
`npm run dev --workspace nextjshx-todoapp-example -- --webpack -p 3100`.
A Haxe syntax or type error leaves the verified last-good page running; fixing
the source republishes and refreshes without restarting Next.

## Why this slice exists

While developing NextJsHx, the stable fixture proved each adapter seam in
isolation but did not prove that the seams compose into a maintained
application. R02 was needed to combine route-aware page props, generated href
companions, static params, generated metadata, special files, ownership, and a
real production build without hiding Next.js behind a parallel runtime.

While developing R03, the browser proof found a second composition gap:
`useActionState` returned the correct successful action state and the TSV bytes
changed, but the current file-backed Server Component remained stale. The
reusable native hook therefore calls Next's `router.refresh()` only after an
`ok` result. Rejected input stays local, while successful create, toggle, and
delete operations request the ordinary Next server-tree refresh.

While developing R04, introducing a real `use cache` list boundary exposed the
next layer of that same problem: persistence changed and `router.refresh()` ran,
but a tagged cache could still serve the prior projection. The fix is native
and context-specific. Server Functions call `updateTag` for immediate
read-your-own-writes behavior; the public Route Handler calls
`revalidateTag(tag, {expire: 0})`. Both target the same stable tag declared next
to the cached reader. No application-local cache or refresh protocol was added.

Enabling native `typedRoutes` in the authored Next config also exposed a pinned
Next 16.2.12 declaration mismatch: its generated `link.d.ts` still returns
global `JSX.Element`, while React 19 publishes that identity as
`React.JSX.Element`. The small `app/environment.d.ts` bridge aliases only those
React-owned JSX types. Strict library checking remains enabled, so the bridge
does not hide other Next or React declaration failures.

The same production build showed that Next rejects an explicit
`dynamicParams` export whenever Cache Components are enabled—even the ordinary
`true` default. The example removes the redundant export, and the generalized
Haxe segment-config validator now reports
`NXHX-SEGMENT-CACHE-COMPONENTS-0002` at the source field for both
`dynamicParams` and `revalidate`, before adapter publication or Turbopack.

Finally, the first request-time list build reported Next's blocking-route
diagnostic because `Server.connection()` delayed the page above Suspense. The
root page now returns the typed `nextjs.raw.react.Suspense` surface immediately
and performs connection plus cached data work in its async child. This preserves
Next's partial-prerendering fallback and still guarantees that production
runtime state, rather than build-time fixture bytes, selects the first cache
entry.

While developing R06, the existing browser smoke revealed three evidence gaps:
it was embedded in one script instead of a first-class Playwright suite, every
run shared one state/cache identity, and the todo app had no resettable error
path. The dedicated suite now starts one independently isolated production
server per journey. Each
gets a validated `NEXTJSHX_TODO_RUN_ID`, an owner-only TSV directory, and a
matching cache key/tag namespace. `TodoError` and `FailureRecoveryProbe` add a
real, opt-in recovery drill using the exact Next `Error` and `reset` contract.
The Playwright config fixes one worker and zero retries, so a deterministic
failure cannot disappear behind a rerun.

While developing the keyboard command surface, cmdk's faithful callback shape
exposed a different boundary risk: `onSelect` yields search text, but search
text is not an application command. Routing that value through a string switch
would make typos and missing payloads runtime states. The Todo layer instead
captures a closed Haxe command or an already-checked `Todo`, ignores the host
search string, and exhaustively delegates to the existing typed URL, focus, and
route intents. The source-owned shadcn wrapper remains reusable and contains
only cmdk/Radix presentation, shortcut, and focus plumbing.

## Closed, shareable discovery state

Status, priority, view, and search belong to the URL rather than a parallel
client store. The App Router page uses nuqs's native adapter with push history,
while one Haxe Hook turns its tuples into an intent-oriented application model.
Search edits replace the current history entry; discrete filter and view changes
remain replayable through Back and Forward. Reset clears all four URL dimensions,
including a Board-only lens, and returns to the canonical list URL.

List and Board are two projections of that same server-owned collection, never
two synchronized client stores. Board partitions the filtered result through a
closed `TodoBoardLanes` Haxe type into a wide active register and a compact filed
archive, with visible counts and useful empty states. Each status lane owns its
own dnd-kit provider: reordering can organize work inside a status, while the
explicit completion control remains the only operation that changes status.

While building this slice, plain string parsers made invalid filter states
representable and widened the generated TypeScript contract. The reusable
semantic parser now requires one String-backed enum abstract, one inline
non-empty domain, and a default from that same nominal type:

```haxe
enum abstract TodoStatusFilter(String) to String {
  final All = "all";
  final Open = "open";
  final Done = "done";
}

final status = Nuqs.useQueryState("status", Parsers.stringLiteral([
  TodoStatusFilter.All,
  TodoStatusFilter.Open,
  TodoStatusFilter.Done
], TodoStatusFilter.All));
```

The Haxe call stays concise, while generated TypeScript looks like a deliberate
native nuqs call and retains the closed union:

```ts
const status = useQueryState<"all" | "done" | "open">(
  "status",
  parseAsStringLiteral<"all" | "done" | "open">(
    ["all", "open", "done"],
  ).withDefault("all"),
);
```

There is no parser local, assertion, compiler carrier, or runtime Haxe wrapper.
An invalid host URL value resolves through nuqs to `TodoStatusFilter.All`
before the application sees it. An empty or stored value list, plain `String`,
mixed enum domains, a wrong setter domain, or a malformed query key instead
fails at the Haxe source. The raw nuqs binding remains available for a genuinely
dynamic parser.

## Typed priority runway

The planning view answers three concrete questions about the current URL lens:
how many notes remain open, whether urgent P0 work remains, and how open versus
filed work is distributed across P0, P1, and P2. Changing status, priority, or
search updates the summary, chart, and table together. Changing only List versus
Board does not relabel the same content as filtered.

`TodoPlanning.project` is a pure exhaustive Haxe projection over the closed
`TodoPriority` domain. It emits ordered rows through the reusable two-series
model:

```haxe
final planning = TodoPlanning.project(projection.visible);
final chart = StackedBars.create(
  planning.rows,
  "Open",
  "var(--planning-open)",
  "Filed",
  "var(--planning-filed)"
);
```

The HXX composes Recharts directly rather than hiding it behind an application
wrapper:

```haxe
<BarChart
  data={chart.rows}
  responsive={true}
  accessibilityLayer={true}
  layout={BarChartLayout.Vertical}
  className="planning-chart"
>
  <XAxis type={AxisType.Number} allowDecimals={false} />
  <YAxis type={AxisType.Category} dataKey={StackedBarCategoryKey.Category} />
  <Bar dataKey={chart.primary.key} fill={chart.primary.color} stackId="work" />
  <Bar dataKey={chart.secondary.key} fill={chart.secondary.color} stackId="work" />
</BarChart>
```

Haxe checks the row fields, axis key, numeric-series key, and props at their HXX
source spans. For example, using the category key as a Bar series or passing
`barSize="wide"` fails before rejected TSX is written. Generated output remains
the ordinary named `recharts` import and component tree.

Recharts' public Tooltip payload still contains `any`, so this reviewed subset
does not bind it. The chart instead has Recharts' accessibility layer and an SVG
description, followed by a visible legend and semantic table built from the
same `StackedBarDatum` rows. The table is not a second calculation: pointer,
keyboard, and screen-reader users receive the exact values drawn in the chart.

See [Typed planning charts with Recharts](../../docs/recharts.md) for the exact
package identity, the TypeScript 6 transitive compatibility pin, supported
exports, negative controls, and upgrade boundary.

## Keyboard-first typed command desk

The visible command register and Control/Command+K shortcut open one searchable
surface for creating a field note, focusing ledger search, changing URL-backed
status/priority/view lenses, resetting discovery, and opening any currently
visible Todo. cmdk owns filtering and keyboard selection; the Haxe layer owns
the domain:

```haxe
private enum abstract TodoCommand(String) {
  final FocusCreate = "focus-create";
  final StatusOpen = "status-open";
  final ViewBoard = "view-board";
}

final commandLabel = label(command);
final commandDescription = description(command);
final commandKeywords = [commandLabel, commandDescription].concat(keywords(command));
final select = function(_value:String):Void {
  execute(command, props);
};

<UiCommandItem
  value={value(command)}
  keywords={commandKeywords}
  focusTargetId={focusTarget(command)}
  onSelect={select}
>
  {commandLabel}
</UiCommandItem>
```

The ignored callback argument is cmdk's normalized search value, not an
application action. `execute` switches exhaustively over `TodoCommand` and
calls the same typed selectors used by the visible discovery controls. A
contextual Todo command accepts a closed `Todo` and navigates with
`TodoDetailPage.href({id: todo.id})`; it cannot lose the required route payload.
The explicit stable value means cmdk no longer derives search terms from child
text, so the Haxe layer always adds the visible label and description before
domain aliases. Users can search the exact words they see without making those
words the application command identity.
By contrast, a `dispatchByString(value)` callback is deliberately rejected as
the application architecture because it can represent misspelled or stale
commands.

The shared Haxe facade also makes component misuse fail at the HXX source:
`onSelect` must accept `String`, `keywords` must be `Array<String>`, and
`modKShortcut` must be `Bool`. Those exact negatives run before TypeScript
exists. Generated TSX still imports the source-owned Command components through
their ordinary named module exports and contains no assertion, cast, reflection,
or string-based application dispatcher.

The shortcut is opt-in and supplements a visible trigger. The dialog and list
have application-specific accessible names, the search input receives initial
focus, Escape returns focus to the trigger, and create/search commands move
focus to their existing page controls after the dialog closes. URL commands
return to the trigger and update the shareable lens. The mobile treatment is a
viewport-contained bottom sheet rather than a separate interaction model.

See [Typed command surfaces with cmdk](../../docs/cmdk.md) for the exact package
identity, raw/source/semantic ownership, negative controls, bundle evidence,
and upgrade contract.

## Accessible Haxe-owned sorting

The ledger also exercises a maintained dnd-kit integration without moving
interaction ownership into a hand-written TSX island. Each Haxe row calls one
top-level semantic Hook, attaches its checked refs to the exact DOM elements,
and uses a stable domain ID as the React key:

```haxe
final sortable = DndKit.useSortable(props.todo.id, props.index);
final rowProps:SortableRowElementProps = {
  ref: sortable.ref,
  className: stateClass
};

return <li {...rowProps} data-sortable-item="true">
  <button
    ref={sortable.handleRef}
    type="button"
    className="drag-handle"
    aria-label={"Reorder " + props.todo.title}
  >
    <span aria-hidden="true">↕</span>
  </button>
  <span>{props.todo.title}</span>
</li>;
```

The parent emits `key={todo.id}` for every row. That key is not cosmetic:
dnd-kit's optimistic sorting temporarily moves DOM nodes before React state is
committed. Without stable identity, React may reconcile rows by position and
leave the visual DOM in its pre-drop order even though Haxe state and the live
announcement changed. The production browser negative exposed exactly that
failure; the generated-output gate now locks the authored key.

`DndKit.reorder` validates the package's `string | number` identity boundary,
missing/stale entities, and optimistic projected index before it calls the
real `@dnd-kit/helpers` `arrayMove`. Its closed result forces the application to
handle moved, unchanged, cancelled, incomplete, stale, unsupported-ID, and
invalid-projection outcomes explicitly. There is no listener prop bag, event
assertion, or runtime Haxe wrapper; generated TSX imports
`DragDropProvider`, `useSortable`, and `arrayMove` from their canonical package
entrypoints.

The browser lane proves a desktop pointer move, the package keyboard sensor
with live announcement, and pointer sorting at 390 × 844. The pointer helper
scrolls both authored endpoints into the viewport and requires
`aria-pressed="true"` before movement, so a coordinate miss cannot masquerade
as drag-and-drop evidence. HXX negatives independently reject wrong IDs,
indices, callbacks, ref values, ref targets, and Hook placement before any TSX
exists. See the [dnd-kit integration reference](../../docs/dnd-kit.md) for the
raw/semantic boundary and exact controls.

## Deterministic persistence

The application reads a closed five-column TSV schema through
`todoapp.persistence.TodoStore`. The tracked `data/seed.tsv` is the clean-build
fallback. CI copies those bytes to the ignored
`.nextjshx/todoapp-state.tsv` default runtime file before building. Production
smoke and Playwright instead create
`.nextjshx/runs/<validated-run-id>/todoapp-state.tsv`, so parallel or failed
runs cannot reuse mutable bytes.

Every server read reopens that shared file. Mutations replace it atomically
through an owner-only temporary file, so a reader never observes a partial TSV.
This keeps build workers and the production server deterministic without an
ORM, a JSON-to-domain cast, or process-local mutable state. IDs, booleans,
priorities, field counts, lengths, line breaks, whitespace, and duplicates are
validated before a `Todo` value exists.

This store is fixture infrastructure, not a production concurrent database. A
real deployment should replace it with a datastore that provides transactional
concurrency, durable backups, and application-specific access control.

Because `todos/loading.tsx` establishes a streaming boundary, the pinned Next
16.2.12 runtime deliberately commits `200 OK` before a later `notFound()` can
interrupt the detail render. Next then renders the Haxe-owned not-found view,
adds `robots=noindex`, and records its internal 404 control-flow marker. The
smoke test locks all three signals. Removing the loading boundary would produce
a non-streamed HTTP 404, but would discard required application behavior merely
to change transport presentation; NextJsHx therefore preserves and documents
the framework semantics instead of rewriting them.

## Typed navigation: positive and negative

Application code names the destination page and supplies its Haxe-native param
record:

```haxe
<Link href={TodoDetailPage.href({id: todo.id})}>{todo.title}</Link>
```

The companion URL-encodes the value and projects the result to Next's exact
``Route<`/todos/${string}`>`` type. Missing, extra, or wrongly typed params fail
in Haxe, while Next typegen remains the second verifier.

Without the companion, an arbitrary string cannot be promoted to the route
type:

```haxe
final forged:RouteHref<TodoDetailPattern> = "/todos/unchecked"; // Haxe error
```

No cast, `Dynamic`, generated `.next` edit, or hand-written route registry is
used to bypass that failure.

## Typed Server Function mutations: positive and negative

The Haxe Client Component imports a generated action ref, never the raw server
implementation, and gives that precise signature to the React 19 hook seam:

```haxe
final draft = React.useOptimistic(
  initialDraft,
  (_current:OptimisticDraft, next:OptimisticDraft) -> next
);
final mutation = MutationHook.useTodoMutation(
  ServerFunction.ref(TodoActions.create),
  TodoMutationOperation.Create,
  "Intake desk ready.",
  formData -> switch TodoInputCodecs.draftMutationForm(formData) {
    case Decoded(input):
      draft.apply({
        active: true,
        title: input.payload.title,
        note: input.payload.note,
        priority: input.payload.priority
      });
    case Rejected(_): {}
  }
);
final form:FormProps<String> = {action: mutation.action};
```

The action decodes a closed set of `title`, `note`, and `priority` fields and
returns `TodoMutationState`, a plain immutable record containing a closed
phase, closed operation, safe message, retryability, and typed `DecodeIssue`
values. Missing, repeated, unexpected,
untrimmed, multiline, oversized, or invalid-priority fields are rejected
without mutating persistence. Framework-owned `$ACTION_*` transport fields are
ignored, but an arbitrary extra user field is still an error.

Without `ServerFunction.ref`, a client import would pull
`todoapp.actions.TodoActions` and its Node persistence graph across the client
boundary; the environment audit rejects that raw server-to-client edge. Without
the closed decoder, code such as `formData.get("title")` would leave file and
cardinality checks implicit and could admit a tab that corrupts the TSV schema.
The browser negative control submits a whitespace-only title, observes the
typed `form.title` issue, and proves the three-record state remains unchanged.

Create, toggle, remove, and reorder all use the semantic
`React.useOptimistic(passthrough, reducer)` surface. Haxe owns the projected
state and closed reducer actions; the emitted code calls React's ordinary
`useOptimistic` and tuple dispatcher directly. Pending feedback is both visible
and live-announced, controls close the duplicate-submit window, failures restore
the current Server Component props, and the retained submission can be retried
after the browser reports that it is online again.

Each new attempt receives a validated `mutationId` inside the precise native
React adapter. A retry reuses that identity. The server writes a successful
operation receipt, so a response lost after commit can be retried without
creating twice, toggling back, deleting twice, or applying order twice. The
Playwright control deliberately lets the real action commit, replaces only its
browser response with HTTP 503, verifies rollback, goes offline, reconnects,
and retries all four operations. The final TSV and four unique receipt rows
prove reconciliation rather than a cosmetic animation. No failure flag,
latency query, test header, or environment backdoor exists in production code.

The fixture receipt sidecar is intentionally bounded evidence, not a production
transaction. A real datastore must atomically commit the domain write and an
idempotency key scoped to the authenticated actor, tenant, and operation.
Possessing or guessing a replay ID grants no authority. Every Server Function
must still authenticate and authorize before reading or mutating its target,
and public failures must remain redacted.

Every Server Function is a public HTTP mutation boundary. This fixture has no
identity on purpose, but production code must authenticate the current actor
and authorize that actor against the exact record inside each action before
calling persistence. Hiding or disabling the Haxe/shadcn button is useful UX;
it is not authorization.

## Typed Route Handler and cache invalidation: positive and negative

The root page crosses the reusable cache boundary through the generated ref;
it never imports the raw cached implementation:

```haxe
final list = CacheFunction.ref(CachedTodos.list);
final todos = await(list(TodoStore.cacheScope()));
```

`CachedTodos.list` declares `cacheLife` and `cacheTag` inside its generated
async `"use cache"` wrapper. Request-derived data stays outside that shared
scope. The `GET /api/todos` handler reads `Headers.headers()` and
`Headers.cookies()` in its valid Route Handler context, then calls the cached
function and returns a closed JSON projection. The runtime proof sends a known
header and cookie and requires both exact values in the typed response.

The JSON mutation uses the same title, note, and priority rules as the native
form:

```haxe
return switch await(RequestDecoder.json(request, TodoInputCodecs.draftJson)) {
  case Decoded(draft):
    final todo = TodoStore.create(draft.title, draft.note, draft.priority);
    Cache.revalidateTag(TodoCacheTag.current(), {expire: 0});
    ResponseJson.withStatus(success(todo, context), 201);
  case Rejected(issues):
    ResponseJson.withStatus(rejected(issues, context), 400);
};
```

A malformed JSON body returns HTTP 400 with `ok: false`, the stable
`invalid_json` code, path `$`, a safe message, `todo: null`, and the separately
decoded request context; the runner proves persisted
bytes and visible rows remain unchanged. An exact valid body returns HTTP 201,
persists one record, expires the already-primed list tag, and becomes visible
after the next production server render.

The scope argument is also part of Next's cache key, and
`TodoCacheTag.current()` includes the same validated run identity. Isolating
only the file would be insufficient: a failed E2E process could otherwise
leave a cached projection for the next run even though that run received fresh
TSV bytes.

Without invalidation, the write alone is not sufficient:

```haxe
TodoStore.create(title, note, priority); // cached list may remain stale
```

Likewise, moving `Headers.headers()` or `Headers.cookies()` into ordinary
`CachedTodos.list` would couple a shared entry to request state; NextJsHx rejects
that source shape with `NXHX-CACHE-REQUEST-0006`. The negative controls explain
why the request context and cache boundary are separate rather than merely
showing the successful form.

`POST /api/todos` is intentionally unauthenticated only because this is a
deterministic local fixture. A public deployment must authenticate the actor,
authorize creation in the target ledger, apply rate and body-size limits, and
use a transactional datastore before persisting or invalidating shared state.

The UI primitives remain reusable: Button, Card, Badge, Input, Textarea, and
Command live in `@nextjshx/showcase-ui`, while application composition and all
interaction state remain Haxe-owned. The mutation/retry Hook and deliberate
recovery Hook are authored in Haxe: they use the closed React 19 and Next.js
bindings directly, so Haxe checks the action tuple, retry state, router refresh,
online-store subscription, refs, callbacks, and recovery transition before
TSX exists. The source-owned Command TSX is presentation infrastructure
consumed through exact HXX props, not an application behavior island. Native
TypeScript-to-Haxe Hook interop remains covered separately by Patchbay 06.

## Playwright production evidence: positive and negative

The suite is intentionally separate from source snapshots and raw HTTP smoke:

```sh
npm run test:example:todoapp:build
npm run test:example:todoapp:e2e
```

Positive journeys visibly observe the Haxe `loading.tsx`, navigate generated
links, render and reorder the status-real Board, reorder the List by desktop
pointer, keyboard, and narrow-screen pointer,
open and search the command desk by pointer and shortcut, prove Escape and
post-command focus, update a URL-backed view command, and navigate a typed Todo,
create/toggle/delete through Server Actions, refresh an already-primed cache
after a Route Handler write, hydrate the not-found view, and recover from
`FIELD_LEDGER_RECOVERABLE_RENDER` through the typed Haxe reset button. A
bounded test-only server delay accepts only `0`, `250`, `500`, `750`, `1000`,
or `2000` milliseconds; it makes the real streaming boundary observable rather
than mocking its DOM.

Negative evidence sends actual malformed bytes, requires the exact typed 400,
and compares the owner-only TSV before and after. Browser `pageerror`, console
errors, hydration warnings, request failures, and unexpected HTTP failures are
fatal during fixture teardown. The only classified exceptions are the named
recoverable error and exact `net::ERR_ABORTED` RSC requests that Next cancels
when the loading/navigation test leaves a route. Broad console or network
allowlists are not used.

Without per-run cache and state identities, test order could decide which
records appear. Without `retries: 0`, an intermittent first failure could still
produce a green job. Without teardown-level diagnostics, a visually successful
click could hide a hydration mismatch. The checked config and source gate lock
all three protections.

## Run from this repository

Install the root toolchain once, then run the evidence commands from the
repository root:

```sh
npm install
npx --no-install lix download
npm run test:example:todoapp
```

The runner builds the internal CLI, compiles the source-owned shadcn theme,
links the root lockfile-installed dependencies into this isolated example, and
performs a clean `nextjshx build -- --turbopack`. Raw smoke and fourteen zero-retry
Playwright journeys then prove typed GET request context, malformed and valid
JSON POST behavior, UI-visible cache invalidation, invalid and valid native
actions, a newly created dynamic detail route, toggle, delete, visible loading,
typed navigation, shareable URL filters with Back/Forward semantics, invalid
domain fallback, a truly empty persisted ledger in both List and Board,
priority-runway/table agreement, responsive chart focus,
status-real Board grouping, lane-local sorting,
desktop/keyboard/mobile List sorting, error reset, runtime
persistence, and Haxe-owned streamed not-found behavior without unexpected
console, page, hydration, request, or response errors.
