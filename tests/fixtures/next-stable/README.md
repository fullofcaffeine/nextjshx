# Stable Next.js fixture

This is the clean production-build integration proof, not the eventual public
example. It invokes the repository CLI from this consumer package, compiles
the annotated pages, typed-slot layout, Route Handler, request proxy, loading,
error, not-found, and slot-default Haxe declarations through the exact
Lix-locked genes-ts revision. It publishes only
their thin manifest-owned Next convention adapters. The `/haxe` page supplies
static metadata and literal segment config; `/products/[slug]` supplies generated
metadata, a Promise-returning static route list, and `dynamicParams: false`.
Native pages remain beside them to prove gradual Haxe/TypeScript adoption and to
drive the special-file runtime states. The Haxe-owned `/feed`, canonical
`/photo/[id]`, and `@modal/(.)photo/[id]` views form a real parallel/intercepted
route rather than a source-only topology fixture.

A test-only `/haxe` profile imports a CSS Module through Genes' closed
companion. Lightning CSS reports the exact keys before Haxe compiles. A
reviewed JSON file provides a separate expected list. The fixture proves that
Haxe rejects `styles.missing`. Next reports the same runtime keys, and Chrome
observes the expected color. Next still owns CSS processing and final class
values. The normal development profile does not enable this import yet.

The build selects genes-ts's generic `genes.ts.jsx_import_source=react`
profile because React 19 exposes the `JSX` type namespace from its module
rather than relying on an ambient global.

The page/layout and Route Handler macros add narrow standard-Haxe `@:keep`
metadata because only generated TypeScript adapters call their declarations.
The build includes the owning Haxe packages so annotations are discovered;
full DCE stays enabled, and no fake Haxe runtime call is needed. The page's
inline `href()` companion is also emitted with exact Next `Route<"/haxe">`
typing. The `/haxe` render also calls the product page's generated
`hrefWithQuery()` companion, proving a closed Haxe query schema becomes the
exact `/products/first?page=2&tag=haxe+next&tag=typed` link without retaining
the ProductPage implementation or a helper runtime.

The verification commands build the CLI and provide package-local links to the
lockfile-installed dependencies. The runner first removes prior generated
state. It then prepares the CSS companion and runs `nextjshx generate`.
Finally, it runs the native Next production build with `--turbopack` or
`--webpack`. The generation command performs Haxe compilation, transactional
adapter publication, `next typegen`, and strict TypeScript. The fixture checks the generated modules,
all twelve adapters, reviewed adapter snapshots, and the ownership manifest. The
smoke command starts that production build on an ephemeral loopback port,
proves the Haxe root layout supplies `<html>`, `<body>`, and children around
`/`, `/haxe`, and `/products/first`, verifies both static and generated metadata,
proves both generated product slugs resolve while an ungenerated slug returns
404, checks the server-rendered typed query link, verifies the matcher-selected
Haxe proxy response header, executes the Haxe-authored GET, POST, and DELETE methods,
observes a streamed Haxe loading fallback, receives a Haxe not-found view with
HTTP 404, and uses a real browser to prove soft navigation retains `/feed`
behind an open Haxe-authored dialog while reloading `/photo/42` selects the
canonical Haxe page and `@modal/default`. The browser also checks the CSS Module
style, then triggers and resets the Haxe error boundary.

```sh
npx --no-install lix download
npm run test:fixture:next-stable
npm run test:fixture:next-stable:webpack
npm run test:fixture:next-stable:smoke
```

CI expands the same fixture into four blocking combinations: Node 20.9.0 and
24.18.0, each with Turbopack and webpack. The generic
`test:fixture:next-stable` command remains the primary Turbopack lane; the
explicit webpack command supplies compatibility evidence without changing
Next.js runtime or application source.

The root package overrides TypeScript's compatibility-wrapper core to the
documented 6.0.2 compiler and PostCSS to the audited 8.5.23 release. The
fixture verifies both resolutions before compiling, then proves the PostCSS
override remains compatible by completing a real Next production build.

`src-gen/`, `.next/`, `.nextjshx/`, `next-env.d.ts`, and TypeScript build
metadata are generated and intentionally untracked. The test removes the live
generated adapters and manifest after verification while retaining the
compiled `.next` output for the separate smoke command. Native proof pages stay
application-owned; the root layout, `/haxe`, `/feed`, `/photo/[id]`, intercepted
photo, `/products/[slug]`, four special-file adapters, API route, and exact root
`proxy.ts` are generated and manifest-owned.

The separate prepare step records a current limitation. `nextjshx build`
cleans `src-gen` before Haxe compiles, as a safe production build must. The
future CSS host integration must prepare its private companion and staged CSS
after that clean step. The fixture makes this order visible and does not claim
that normal project setup or watch mode owns it yet.
