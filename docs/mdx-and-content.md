# MDX and portable content

NextJsHx treats local MDX and remote content as two different trust models.
They may share visual components, but they must not share an evaluation path.

## Trusted local MDX

Repository-owned `.md` and `.mdx` files are application source. Next's normal
`@next/mdx` integration compiles them, and Next still owns routing, Server and
Client Component boundaries, bundling, and deployment.

Declare the global component registry in Haxe:

```haxe
package atlas.content;

import atlas.client.SignalPlot;

using nextjs.client.ClientComponent;

@:next.mdxComponents
class AtlasMdxComponents {
	public static function components() {
		return {
			SignalPlot: SignalPlot.client()
		};
	}
}
```

The registry deliberately uses a directly returned object literal:

- Haxe infers the exact field names and component prop types.
- Names must be PascalCase, so a custom component cannot silently replace an
  intrinsic HTML element.
- Every value must be an exact `ComponentType<Props>` produced by a reviewed
  Haxe or native component boundary.
- Empty, computed, parameterized, or open registries fail at the Haxe source
  span.

The CLI publishes the appropriate Next convention location:

| App Router root | Generated convention |
| --- | --- |
| `app` | `mdx-components.tsx` |
| `src/app` | `src/mdx-components.tsx` |

The generated module is intentionally ordinary TypeScript:

```ts
import { AtlasMdxComponents as NextJsHxMdxRegistry } from "./src-gen/atlas/content/AtlasMdxComponents";

export const useMDXComponents: typeof NextJsHxMdxRegistry.components =
  NextJsHxMdxRegistry.components;
```

`typeof` preserves the closed Haxe registry instead of widening it to MDX's
ambient string-indexed map. There is no wrapper, assertion, compatibility shim,
or alternate runtime. The file is manifest-owned; a native file at the same
path blocks generation until ownership is explicitly resolved.

Install and configure `@next/mdx` through the normal Next.js configuration.
Remark and rehype plugins remain native Next configuration because their
ordering and options are build-tool concerns, not Haxe application semantics.
Field Atlas pins and exercises `remark-gfm` for tables, `rehype-slug` for
heading IDs, and `rehype-pretty-code` for highlighted code. Their versions,
integrities, licenses, declaration entries, declaration digests, and required
exports are recorded separately in `config/package-integrations.json`.

MDX parses Markdown inside multiline JSX containers. When an explicit HTML
element should contain only text, use an explicit string child so Markdown
cannot insert a second block element:

```mdx
<p className="dispatch-deck">{"One paragraph, with no nested paragraph."}</p>
```

The production browser gate rejects invalid nesting and hydration errors. This
matters because a malformed `<p><p>…</p></p>` can look acceptable in static
markup while React must discard and regenerate that subtree in the browser.

## Untrusted or remote content

MDX includes JavaScript and JSX and therefore must not be evaluated from a CMS,
API response, webhook, database field, or other untrusted source.

Remote content must instead cross an `Unknown` boundary, decode immediately
into the closed portable content-block model, and render through an exhaustive
Haxe switch. Unsupported block kinds, malformed props, and executable payloads
fail as data. They never become source code.

`PortableContentDecoder.document(value)` accepts a JSON array of:

- `Heading`, with levels 2 through 4;
- plain-text `Prose`;
- `Callout`, with note, insight, or caution tone;
- `Quote`, with optional attribution;
- display-only `Code`, with a reviewed language label;
- a finite, bounded `DataSeries`;
- root-relative `Media` with required alternative text and dimensions; or
- a labeled `Metric`.

Each variant has its own exact field set and size limits. Media rejects remote
protocols, protocol-relative paths, traversal, encoded segments, queries, and
fragments. Code is a string child under `<code>` and React escapes it; the
decoder never converts it into markup.

`ContentBlockRenderer.render(blocks)` supplies a semantic baseline.
Applications can write a brand-specific renderer, but Haxe requires its
`switch` to handle every `ContentBlock` variant. Adding a future variant
therefore breaks every incomplete renderer at compile time instead of silently
dropping content.

This separation keeps local authorship expressive while making remote content
portable to WordPressHx and other backends without granting those systems code
execution inside the Next.js application.

## Evidence

Run:

```bash
npm run test:mdx-components
npm run test:content-blocks
```

The focused lane covers deterministic Haxe output, the closed adapter plan,
strict TypeScript, exact negative diagnostics, both supported convention roots,
native-file ownership refusal, all eight portable variants, escaped executable
text, malformed remote data, and an incomplete-renderer compile failure.
