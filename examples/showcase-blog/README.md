# Moraine: typed static blog

Moraine is a small editorial site with a journal index and statically generated
article pages. It demonstrates typed content, metadata, route parameters,
generated hrefs, and a segment-specific 404.

## Why write this in Haxe?

An article slug is a closed domain value rather than an arbitrary path string.
The same typed catalogue drives static paths, metadata, links, and rendering,
so adding an article cannot silently update one layer but miss another. HXX
checks component props and children before TSX exists.

## Architecture

| Haxe source | Vanilla Next.js equivalent |
| --- | --- |
| `blog/app/RootLayout.hx` | `app/layout.tsx` |
| `blog/app/JournalPage.hx` | `app/page.tsx` |
| `blog/app/ArticlePage.hx` | `app/journal/[slug]/page.tsx` plus metadata/static params |
| `blog/app/JournalNotFound.hx` | `app/journal/not-found.tsx` |
| `blog/domain/` | typed content model normally written as TS types/data |

All routes are Server Components and prerender normally through Next. Shared
shadcn components remain native React source with precise Haxe externs.

## The same route in vanilla Next.js

An idiomatic TypeScript page would derive its static paths and metadata from the
same typed catalogue:

```tsx
export function generateStaticParams() {
  return allPosts.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">) {
  const post = findPost((await params).slug)
  return post ? { title: post.title, description: post.dek } : {}
}

export default async function Article({ params }: PageProps<"/journal/[slug]">) {
  const post = findPost((await params).slug)
  if (!post) notFound()
  return <article><h1>{post.title}</h1></article>
}
```

That is already good Next.js. The Haxe version keeps the same module-oriented
catalogue and native `notFound()` behavior, while `PostSlug`,
`ArticlePage.href({slug})`, exhaustive domain values, and HXX move route,
link, prop, and child mistakes to the Haxe source before TSX exists.

The catalogue stays a module, not a class used as a namespace:

```haxe
function find(slug:PostSlug):Null<Post> {
	for (post in all()) {
		if (post.slug == slug) return post;
	}
	return null;
}

<NextLink href={ArticlePage.href({slug: next.slug})}>{next.title}</NextLink>;
```

`PostSlug` carries one named route representation through the catalogue API,
while the generated `href` companion couples URL construction to the page's
dynamic parameter shape. This deterministic example permits string literals to
construct slugs; an untrusted external slug would still need validation.

## Run it

```sh
npm run dev --workspace @nextjshx/showcase-blog
npm run build --workspace @nextjshx/showcase-blog
```

## Gotchas

- `@:async` marks Promise-shaped Haxe methods; it does not introduce another
  scheduler or replace Next’s async component behavior.
- The catalogue is a Haxe module. Page owners are still classes only because
  the current `@:next.page` macro attaches convention metadata to a type; direct
  module-owned pages are tracked as a framework/compiler improvement.
- Call Next’s native not-found control flow after typed lookup fails.
- Edit the Haxe catalogue and authored styles; generated TSX is build output.

See the first-use source comments and the
[showcase guide](../../docs/showcases.md) for route and evidence details.
