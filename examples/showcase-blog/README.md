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
catalogue and native `notFound()` behavior, while `PostSlug`, the generated
`articleHref({slug})` module binding, exhaustive domain values, and HXX move
route, link, prop, and child mistakes to the Haxe source before TSX exists.

The catalogue stays a module, not a class used as a namespace:

```haxe
function find(slug:PostSlug):Null<Post> {
	for (post in all()) {
		if (post.slug == slug) return post;
	}
	return null;
}

import blog.app.ArticlePage.href as articleHref;

<NextLink href={articleHref({slug: next.slug})}>{next.title}</NextLink>;
```

`PostSlug` carries one named route representation through the catalogue API,
while the generated `href` companion couples URL construction to the page's
dynamic parameter shape. This deterministic example permits string literals to
construct slugs; an untrusted external slug would still need validation.

The pages and layout are ordinary Haxe module functions and values, just like
idiomatic Next.js modules:

```haxe
@:next.page("journal/[slug]")
function render(props:PageProps<ArticleParams, SearchParams>):Promise<Element> {
	return props.params.then(params -> {
		final post = find(params.slug);
		return post == null ? missing() : renderArticle(post);
	});
}

function generateStaticParams():Array<ArticleParams> {
	return all().map(post -> {slug: post.slug});
}
```

NextJsHx connects these checked functions to the standard `page.tsx` default
and named exports. Genes emits normal TypeScript/TSX module functions and
constants, so no class is needed merely to hold static fields.

## Run it

```sh
npm run dev --workspace @nextjshx/showcase-blog
npm run build --workspace @nextjshx/showcase-blog
```

## Gotchas

- Promise-shaped route props remain ordinary JavaScript Promises. This example
  uses `.then(...)`; Next still controls when the route is rendered.
- Route owners and the catalogue use Haxe modules. Use classes only when
  construction, inheritance, interface implementation, metadata, or runtime
  class identity is part of the design.
- Call Next’s native not-found control flow after typed lookup fails.
- Edit the Haxe catalogue and authored styles; generated TSX is build output.

See the first-use source comments and the
[showcase guide](../../docs/showcases.md) for route and evidence details.
