# NextJsHx

NextJsHx is a Next.js-first framework for authoring ordinary Next.js
applications and reusable modules in typed Haxe. Haxe compiles to
TypeScript/TSX through [genes-ts](https://github.com/fullofcaffeine/genes-ts), and
small generated adapters provide the exact App Router filenames, directives,
and exports that Next expects.

The project is in foundation work. It has no supported release yet, and its
public API and package shape may change.

## Why NextJsHx?

Next.js with TypeScript is already excellent. NextJsHx keeps it intact and adds
a stronger authoring layer where Haxe can remove duplicated sources of truth,
make application states closed, and report framework mistakes before generated
TSX exists.

| Equally idiomatic Next.js/TypeScript | Additional NextJsHx contract | Native behavior retained |
| --- | --- | --- |
| typed routes check route strings, while parameter models and URL construction remain separate declarations | one route contract checks parameter cardinality and generates `Page.href({id})` | App Router, navigation, and Next typed routes |
| TypeScript checks TSX props and callbacks directly | HXX checks the same component contract in Haxe and combines it with route, graph, and domain facts before emitting TSX | direct JSX/TSX and React elements |
| React setters intentionally accept replacements and updater functions | named `.set(value)` and `.update(previous -> next)` remove callable-state ambiguity | native React Hooks and official Hook lint |
| Next directives define strong boundaries, but application imports can still bypass intended entrypoints | explicit graph classifications and typed boundary references make the legal crossing the discoverable path | RSC, Flight, directives, and Next transport |
| good TypeScript applications validate external data with a schema | exhaustive `Decoded<T> | Rejected` results make rejection handling and the closed domain model part of Haxe control flow | Web `Request`, `FormData`, query, and JSON behavior |
| generators can collide with hand-owned routes | digest-backed ownership, atomic publication, and exact rollback | ordinary Next convention files and builds |

An idiomatic TypeScript content module and link are concise:

```tsx
export function findPost(slug: string): Post | undefined {
  return posts.find(post => post.slug === slug)
}

<Link href={`/journal/${encodeURIComponent(post.slug)}`}>{post.title}</Link>
```

The Haxe version also uses a module function—there is no static utility class:

```haxe
function findPost(slug:PostSlug):Null<Post> {
	return allPosts().find(post -> post.slug == slug);
}

<NextLink href={ArticlePage.href({slug: post.slug})}>{post.title}</NextLink>;
```

Next still owns the link and route. Haxe carries the named `PostSlug`, checks
route cardinality, and generates the URL encoder from the page contract, so a
renamed or missing parameter fails at the HXX source instead of drifting into a
separate template string. The Haxe source keeps the familiar collection
operation. Native `Array.find` lowering is a separate framework-neutral
genes-ts output-quality goal; until that equivalence is implemented and
verified, generated output may retain Haxe's `Lambda.find` helper.

React Server Components use React Flight to carry rendered server trees and
supported values into the client runtime. NextJsHx keeps that native protocol
and checks its value contract in Haxe before generation; see
[React Flight values](docs/react-flight.md) for the plain-language model,
supported value families, and the Genes-versus-NextJsHx ownership boundary.

## Next-native compatibility

For every supported capability, NextJsHx targets the same runtime and
deployment behavior as vanilla Next.js:

- the App Router, React Server Components, React, compiler/bundler, dev server,
  production build, and deployment artifacts remain Next-owned;
- native TypeScript and JavaScript remain first-class and can coexist route by
  route with Haxe-owned source;
- `nextjs.raw.*` exposes reviewed faithful host contracts, while `nextjs.*`
  adds Haxe inference, closed types, generated companions, and earlier
  diagnostics; and
- packages retain their canonical ESM and React identities—there is no
  NextJsHx component or RPC runtime.

This does not mean the unreleased framework already wraps every Next convention
or npm declaration. Unsupported semantic capabilities remain native or fail
explicitly; they are never approximated with broad types or casts. See the
[exact compatibility contract](docs/compatibility.md) and
[architecture](docs/architecture.md).

## One Haxe source, native output choices

genes-ts can validate one Haxe/HXX source graph and emit several native forms:

- typed `.ts`/`.tsx` for strict TypeScript, native tooling interop, and source
  inspection;
- type-erased `.js`/`.jsx` after the same Haxe/HXX checks; and
- classic split ESM JavaScript with optional `.d.ts`, avoiding a TypeScript
  compilation step when that is the better deployment tradeoff.

NextJsHx currently qualifies TypeScript/TSX as its application output contract.
Independent JavaScript/JSX cells are tracked but are not claimed from the
TypeScript evidence alone.

A separate output-intent axis is also planned: `reviewable` will require
careful handwritten-quality native source, while `optimized` may use
whole-program Haxe knowledge only when final Next-pipeline benchmarks justify
the transformation. That switch is not released today. Current genes output
already preserves direct JSX trees and offers a minimal-runtime TypeScript
profile, but those capabilities must not be mislabeled as the complete
reviewable/optimized product contract. See the
[output-profile ADR](docs/adr/0008-independent-output-language-and-intent-profiles.md) and
[genes extraction review](docs/genes-extraction-review.md).

## A tighter compiler feedback loop

NextJsHx is designed to reject invalid application intent at the Haxe edit,
before publishing adapters or asking Next and TypeScript to analyze a generated
tree. A warm compiler server keeps typed modules in memory; successful
compilations publish one closed plan, while a failed compilation leaves the
exact last-good Next application running.

Examples of deliberately early feedback:

| Edit | Haxe/NextJsHx result | Downstream work avoided on failure |
| --- | --- | --- |
| omit a dynamic route param from `ArticlePage.href(...)` | error at the Haxe call with the missing field | URL generation, adapter publication, Next typegen |
| pass the wrong callback, ref, or exact child shape in HXX | error on the authored attribute/child span | TSX emission and Next compilation |
| call a Hook conditionally or pass callable eager state | Hook/state diagnostic in the Haxe function | generated React lint/build cycle |
| import a server-only module into a Client Component | dependency-graph error naming both source owners | invalid client adapter and browser bundle work |
| forget to handle `Rejected(issues)` from external input | non-exhaustive Haxe control flow/type failure | publishing a boundary that assumes trusted input |

TypeScript catches many ordinary TSX mistakes well, and Next remains an
independent final oracle. The intended advantage is that Haxe's closed domain
types and NextJsHx macros can diagnose additional framework invariants in the
authoritative source, then avoid downstream work for an already-invalid edit.
The dev supervisor also keeps the browser on verified last-good output instead
of asking the developer to patch generated code.

This architecture can produce a faster edit-to-diagnostic loop than a complete
vanilla `tsc`/Next validation cycle, but measured speed superiority is still a
release-gated benchmark target. The project is adding paired p50/p95
edit-to-diagnostic and edit-to-ready measurements against an equally idiomatic
Next.js/TypeScript app; until those results exist, the proven claims are early
diagnostic placement, skipped publication on failure, and last-good continuity.
See the [CLI dev-loop contract](docs/cli.md#dev) and
[testing evidence](docs/testing-strategy.md).

## Explore the examples

The examples form a learning path rather than six versions of the same demo:

| Start here | Open it when you want to learn | Additional Haxe contract | What deliberately stays vanilla |
| --- | --- | --- | --- |
| [Pelagic Signal](examples/showcase-landing) | the smallest Server page → Client Component → custom Hook flow | closed direction values, unambiguous state updates, and Haxe-span Hook/prop/event diagnostics | React state, hydration, Fast Refresh, and the `"use client"` boundary |
| [Moraine](examples/showcase-blog) | static params, metadata, dynamic routes, typed links, and segment 404s | one named slug domain and catalogue drive lookup, prerendering, metadata, and encoded hrefs | App Router conventions, Server Components, and `notFound()` control flow |
| [Common Ground](examples/showcase-commerce) | a richer client graph with filters, a cart Hook, image optimization, and shadcn | closed product/money/filter values and a lint-visible generic Hook export | `next/image`, React Hooks, hydration, and the source-owned shadcn Sheet |
| [Field Atlas](examples/showcase-field-atlas) | the difference between trusted executable MDX and untrusted portable content | immediate JSON decoding into an exhaustive content algebra plus checked Recharts props | Next's MDX compiler, GFM plugins, and the real Recharts package |
| [Shared showcase UI](examples/showcase-ui) | precise Haxe consumption of source-owned shadcn, Radix, cmdk, and Lucide | exact variants, callbacks, refs, ARIA fields, and one-element `asChild` children in HXX | the original TSX components, package identities, and Radix behavior |
| [Patchbay](examples/mixed-adoption) | adopting Haxe one route/module at a time in an existing TSX app | checked native externs and Haxe-authored components, Hooks, and functions consumed from TSX | existing native files and a single React/Next ESM graph |
| [Field Ledger](examples/todoapp-next) | the production-shaped composition: actions, forms, cache, URL state, dnd-kit, charts, Route Handler, and browser journeys | closed mutation/input/cache/boundary states and deterministic recovery across the complete app | Server Function transport, Cache Components, packages, Next builds, and deployment |

Each README includes an architecture map, a concise idiomatic TypeScript
comparison, the corresponding Haxe contract, current limitations, and the
focused verification command. A useful reading order is Pelagic Signal,
Moraine, Common Ground, Field Atlas, Patchbay, then Field Ledger; Shared
showcase UI is the interop reference used by several of them.

## Repository quick start

Prerequisites are Node.js 20.9+ or 24, Haxe 4.3.7, and the pinned tools listed
in the [machine-readable support matrix](support_matrix.json) and its generated
[compatibility guide](docs/compatibility.md).

```sh
npm ci --ignore-scripts
npx --no-install lix download
npm run hooks:install
npm test
```

Useful focused commands:

```sh
npm run test:showcases
npm run test:example:mixed-adoption
npm run test:example:todoapp
npm run public:preflight
```

The public application bootstrap is still being productized; today these
commands exercise repository fixtures rather than promise a released
`create-nextjshx` package.

## What is checked today?

The release gates cover positive and negative Haxe compilation, deterministic
generation, strict TypeScript, Next type generation and production builds,
official React Hook lint, server/runtime behavior, real-browser journeys,
package identity, environment containment, generated ownership, rollback, and
stable-package drift.

The main authoring references are:

- [pages, layouts, metadata, and links](docs/pages-and-layouts.md)
- [Client Components and React Hooks](docs/client-components.md)
- [Server Functions and forms](docs/server-functions.md)
- [Cache Components](docs/cache-components.md)
- [Route Handlers and codecs](docs/route-handlers.md)
- [environment boundaries](docs/environment-boundaries.md)
- [package and mixed-language interop](docs/package-integrations.md)
- [generated ownership and publication](docs/generated-output-ownership.md)
- [CLI workflow](docs/cli.md)
- [testing strategy](docs/testing-strategy.md)

The [documentation map](docs/README.md) links the complete reference and ADR
set.

## Architecture principles

- Next.js remains the framework runtime and final graph oracle.
- HXX is checked by Haxe before output; TypeScript and Next are independent
  parity evidence.
- Public APIs have a faithful `nextjs.raw.*` layer and a more ergonomic
  semantic `nextjs.*` layer.
- Framework-neutral Haxe-to-JavaScript/TypeScript, React, HXX, module, source
  map, and tooling capabilities belong in genes-ts and are consumed here.
- Generated files are manifest-owned and never overwrite native source.
- Unsupported behavior fails clearly instead of weakening types.

Detailed design constraints live in [AGENTS.md](AGENTS.md), the
[architecture guide](docs/architecture.md), and the
[ADRs](docs/adr/README.md). The
[boundary-classification ADR](docs/adr/0003-boundary-classification-and-import-graph-enforcement.md)
defines how Haxe graph checks and native Next directives reinforce one another.

## Contributing and safety

This repository uses [Beads](https://github.com/gastownhall/beads) for durable
work tracking. Run `bd prime` before project work. Install tracked hooks with
`npm run hooks:install`, and run `npm run public:preflight` before exposing a
Git ref or changing repository visibility.

Never commit credentials, private data, machine-local paths, generated
dependency trees, or unreviewed broad type escapes.

## License

NextJsHx is licensed under the [GNU General Public License version 3](LICENSE)
(`GPL-3.0-only`).
