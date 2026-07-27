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
- One decoder validates forms and JSON into named domain input.
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
