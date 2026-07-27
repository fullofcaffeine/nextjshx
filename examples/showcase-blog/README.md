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

## Run it

```sh
npm run dev --workspace @nextjshx/showcase-blog
npm run build --workspace @nextjshx/showcase-blog
```

## Gotchas

- `@:async` marks Promise-shaped Haxe methods; it does not introduce another
  scheduler or replace Next’s async component behavior.
- Call Next’s native not-found control flow after typed lookup fails.
- Edit the Haxe catalogue and authored styles; generated TSX is build output.

See the first-use source comments and the
[showcase guide](../../docs/showcases.md) for route and evidence details.
