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

## The same interaction in vanilla Next.js

The native React version is concise and uses the same state machine:

```tsx
"use client"

export function TideDial({ initialLevel }: { initialLevel: number }) {
  const [level, setLevel] = useState(initialLevel)
  const [direction, setDirection] = useState<"rising" | "falling">("rising")
  const raise = () => {
    setDirection("rising")
    setLevel(current => Math.min(94, current + 4))
  }
  return <button onClick={raise}>{direction}: {level}</button>
}
```

NextJsHx does not replace this runtime model. Its improvement is compile-time:
the direction is a closed Haxe value, semantic state distinguishes replacement
from functional update, Hook placement is checked at the Haxe span, and the
Client Component boundary emits an ordinary `"use client"` module.

The Haxe Hook body makes those two state operations explicit:

```haxe
import genes.react.React.useState;

final level = useState(initialLevel);
final direction = useState(TideDirection.Rising);

return {
	level: level.value,
	direction: direction.value,
	raise: () -> {
		direction.set(TideDirection.Rising);
		level.update(current -> current + 4 > 94 ? 94 : current + 4);
	}
};
```

`set` always means replacement and `update` always receives the previous
value. The compiler can therefore reject callable-state ambiguity without
changing the `useState` calls that React executes.

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
- `TideHook` currently has a documented static shell because the NextJsHx
  `@:next.hook` owner contract accepts a public static Hook field. The generic
  Hook authoring, state, and analyzer-visible module-function machinery already
  lives in `genes.react`; removing the remaining Next owner shell is tracked
  separately.

See the first-use comments in the Haxe sources and the
[showcase guide](../../docs/showcases.md) for generated ownership and tests.
