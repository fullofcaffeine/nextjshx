# Field Ledger: flagship NextJsHx application

Field Ledger is the complete reference app: a polished Todo system with Server
and Client Components, typed routes, forms and Server Functions, cache
invalidation, URL-backed discovery, drag-and-drop, charts, loading/error/404
states, a JSON Route Handler, and production Playwright tests.

It is still an ordinary Next.js App Router application. Next owns rendering,
React Server Components, hydration, routing, caching, bundling, Fast Refresh,
and deployment. Haxe owns the application model and checked authoring surface.

## Why Haxe is useful here

- Todo IDs, priorities, filters, routes, commands, mutation results, and chart
  keys are closed types rather than unrelated strings.
- Form and JSON decoders reuse the same closed domain values and field rules,
  then return named input models at their respective boundaries.
- HXX checks tags, component props, callbacks, spreads, and children before TSX
  is generated.
- Exhaustive switches make missing domain cases compile errors.
- Semantic APIs separate replacement from state updates, generate safe hrefs,
  and report server/client boundary mistakes at Haxe source positions.
- Native packages such as shadcn, nuqs, dnd-kit, cmdk, and Recharts keep their
  normal runtime implementations behind precise reviewed bindings.

## Architecture

| Haxe area | Vanilla Next.js equivalent | Responsibility |
| --- | --- | --- |
| `todoapp/app/` | `app/**/{page,layout,loading,error,not-found}.tsx` | route UI and metadata |
| `todoapp/actions/` | `"use server"` modules | validated mutations |
| `todoapp/cache/` | `"use cache"` functions | tagged reads |
| `todoapp/routes/` | `app/api/**/route.ts` | typed HTTP boundary |
| `todoapp/client/` | `"use client"` components and Hooks | interaction and optimistic UI |
| `todoapp/domain/` | TypeScript domain types | closed application model |
| `todoapp/input/` | validation/schema code | shared form and JSON decoding |
| `todoapp/persistence/` | server data module | isolated fixture persistence |

Generated Next convention files are thin adapters owned by
`.nextjshx/manifest.json`; `src-gen/` is compiler output. Do not edit either.

## The same mutation in vanilla Next.js

A good TypeScript Server Function keeps validation, authorization, mutation,
and invalidation visible:

```ts
"use server"

export async function create(previous: MutationState, formData: FormData) {
  const input = CreateTodoSchema.safeParse(Object.fromEntries(formData))
  if (!input.success) return rejected(input.error)
  const actor = await requireActor()
  await authorizeCreate(actor, input.data)
  await store.create(input.data)
  updateTag(todoTag(actor.scope))
  return completed("Created")
}
```

Field Ledger preserves exactly that Next.js execution model and does not
generate authorization. Haxe improves the surrounding contract: action values,
IDs, operations, decode results, cache identities, and boundary references are
closed; malformed input is exhaustively handled; and illegal server/client
edges fail before a `"use server"` adapter is published.

The Haxe action keeps the same security-relevant steps visible:

```haxe
return switch draftMutationForm(formData) {
	case Decoded(input):
		if (wasApplied(Create, input.mutationId)) {
			replayed(Create);
		} else {
			final draft = input.payload;
			final created = createTodo(draft.title, draft.note, draft.priority);
			rememberApplied(Create, input.mutationId);
			Cache.updateTag(current());
			TodoMutationStates.completed(Create, 'Filed "${created.title}".');
		}
	case Rejected(issues):
		TodoMutationStates.rejected(
			Create,
			"Review the marked intake fields.",
			issues
		);
};
```

The example uses deterministic fixture persistence and therefore has no user
identity. A production action must still authenticate and authorize before the
mutation; the annotations provide publication and boundary checks, not
application security policy.

## Development

From the repository root:

```sh
npm run dev --workspace nextjshx-todoapp-example
npm run test:example:todoapp
```

The dev command watches Tailwind and the complete Haxe input graph while one
native Next process owns HMR and Fast Refresh. A Haxe error leaves the verified
last-good app running; fixing it republishes without restarting Next. Pass
supported Next flags after `--`, for example `-- --webpack -p 3100`.

## Suggested reading order

1. `app/RootLayout.hx` and `app/TodoListPage.hx` — server rendering and routes.
2. `input/TodoInputCodecs.hx` — one typed input boundary.
3. `actions/TodoActions.hx` — Server Functions and invalidation.
4. `client/CreateTodoForm.hx` — checked client form and action state.
5. `client/TodoDiscovery.hx` — URL state through nuqs.
6. `client/SortableTodoList.hx` — dnd-kit, Recharts, and optimistic behavior.
7. `routes/TodoApi.hx` — the same domain exposed as JSON.

The first use of each NextJsHx annotation includes an adjacent teaching comment.

## Gotchas

- `@:next.action` exposes a function to untrusted client calls; decode,
  authenticate, and authorize inside the function exactly as in native
  Next.js.
- Use `updateTag` for immediate Server Function read-your-own-writes behavior;
  the public Route Handler uses `revalidateTag` with explicit expiry.
- URL state is canonical. List and Board are projections, not synchronized
  client stores.
- Client Components may import server references, but must not import
  server-only implementation modules.
- The small `app/environment.d.ts` is a pinned Next 16.2.12/React 19 JSX
  compatibility bridge, not a general escape from strict checking.
- Next Cache Components reject redundant `dynamicParams`/`revalidate` exports;
  NextJsHx diagnoses these combinations before adapter publication.

## Evidence

`npm run test:example:todoapp` performs Haxe checks, deterministic generation,
strict TypeScript and Next production builds, runtime smoke tests, and 14
Playwright journeys with isolated persistence/cache identities. See
[the Todo architecture](../../docs/todoapp-flagship.md),
[Server Functions](../../docs/server-functions.md),
[caching](../../docs/cache-components.md), and
[package integrations](../../docs/package-integrations.md) for the detailed
contracts.
