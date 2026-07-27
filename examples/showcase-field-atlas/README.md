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

## The same trust boundary in vanilla Next.js

A strong TypeScript implementation validates unknown JSON before rendering and
uses a discriminated union:

```tsx
type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }

export default function BriefingPage() {
  const blocks = BriefingSchema.parse(readBriefingJson())
  return blocks.map(block => {
    switch (block.type) {
      case "heading": return <h2>{block.text}</h2>
      case "paragraph": return <p>{block.text}</p>
    }
  })
}
```

NextJsHx follows that same safe architecture. Its closed decoder makes rejected
input and every block variant exhaustive in Haxe, HXX checks the resulting
markup and Recharts props before output, and trusted MDX deliberately remains
in Next's native compiler pipeline.

The Haxe page makes rejection a required control-flow branch:

```haxe
final blocks = switch PortableContentDecoder.json(readBrief()) {
	case Decoded(value):
		value;
	case Rejected(issues):
		final summary = issues
			.map(issue -> issue.code + " at " + issue.path)
			.join("; ");
		throw new Error("Portable field brief rejected: " + summary);
};

final rendered = ContentBlockRenderer.render(blocks);
```

The renderer is a module function. More importantly, the switch makes payload
rejection visible: text cannot become JSX, and adding a decode result or
content-block variant requires the Haxe source to handle it.

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
