# Pelagic Signal: Haxe-first landing page

This is the smallest complete NextJsHx site: a static landing page with a
hydrated tide control. Use it to learn the framework before opening the larger
examples.

## Why write this in Haxe?

Haxe checks the page, layout, component props, events, and HXX markup before
generating TSX. The tide state uses a familiar React Hook with a named
`State<Int>` API, while the browser still runs ordinary React and Next.js.
Generated boundary files remain short, conventional Next modules.

## Architecture

| Haxe source | Vanilla Next.js equivalent | Runs in |
| --- | --- | --- |
| `landing/app/RootLayout.hx` | `app/layout.tsx` | server |
| `landing/app/HomePage.hx` | `app/page.tsx` | server |
| `landing/client/TideDial.hx` | a `"use client"` component | browser |
| `landing/client/TideHook.hx` | a custom React Hook | browser |

The App Router, React renderer, Tailwind CSS, Fast Refresh, build, and
deployment model are unchanged. NextJsHx adds typed Haxe authoring and owns only
the generated files listed in `.nextjshx/manifest.json`.

## Run it

From the repository root:

```sh
npm run dev --workspace @nextjshx/showcase-landing
npm run build --workspace @nextjshx/showcase-landing
```

Pass supported Next flags after `--`, for example `-- --webpack -p 3100`.

## Gotchas

- Edit `haxe/` and `styles/app.css`, not `src-gen/` or manifest-owned adapters.
- Use `nextjs.*` for the ergonomic layer and `nextjs.raw.*` when exact host
  behavior is the goal.
- Client state and browser events belong behind `@:next.clientComponent`.

See the first-use comments in the Haxe sources and the
[showcase guide](../../docs/showcases.md) for generated ownership and tests.
