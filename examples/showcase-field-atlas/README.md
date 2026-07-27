# Field Atlas: MDX and portable content

Field Atlas shows two honest content architectures in one Next app: trusted
local MDX and untrusted JSON decoded into a closed portable-content model. A
hydrated Recharts plot demonstrates typed ecosystem interop.

## Why write this in Haxe?

Portable JSON is validated once and becomes an exhaustive content algebra;
renderers cannot forget a block kind or execute payload-provided JSX. Recharts
data keys and component props are checked at HXX source positions. Trusted MDX
remains native because Next’s MDX compiler is already the right tool.

## Architecture

| Source | Vanilla Next.js equivalent | Trust boundary |
| --- | --- | --- |
| `field_atlas/app/*.hx` | layouts and pages | application code |
| `content/*.mdx` | native App Router MDX | trusted local source |
| `data/briefing.json` | CMS/API-like payload | decoded, never executed |
| `AtlasMdxComponents.hx` | root `mdx-components.tsx` registry | typed component map |
| `SignalPlot.hx` | `"use client"` Recharts component | browser |

GFM, heading slugs, syntax highlighting, Next routing, and MDX compilation stay
native. NextJsHx supplies the checked Haxe boundaries around them.

## Run it

```sh
npm run dev --workspace @nextjshx/showcase-field-atlas
npm run build --workspace @nextjshx/showcase-field-atlas
```

## Gotchas

- MDX is executable source; use it only for trusted content.
- External content belongs behind a decoder and a closed model.
- The maintained Recharts subset intentionally omits declarations that expose
  broad host types.

See [MDX and portable content](../../docs/mdx-and-content.md) and
[Recharts](../../docs/recharts.md) for the reviewed boundaries.
