# Maintained showcase sites

The showcase suite is executable product evidence for NextJsHx, not a gallery
of hand-written Next adapters. Four visually distinct App Router sites keep
their routes, layouts, metadata, domain models, HXX markup, and interactive
component ownership in Haxe. They share one source-owned shadcn package and are
validated against native React, Next.js, and TypeScript behavior.

The Haxe-first showcase suite deliberately does not mix in native application
logic. For incremental adoption inside an existing TypeScript application, use
the separate [Patchbay 06 mixed-language example](mixed-language-adoption.md).

## Run the evidence

From the repository root:

```sh
npm run test:showcases:source
npm run test:showcase-ui
npm run test:showcases
```

`test:showcases:source` is the fast authored-source policy check.
`test:showcase-ui` is the focused positive/negative component contract.
`test:showcases` is the complete maintained lane and is also part of
`npm test`. It:

1. validates exact toolchain and package pins, source policy, and local-path
   safety;
2. compiles each site twice from a clean tree and compares every emitted Haxe
   module, owned adapter, and ownership-manifest digest;
3. runs strict TypeScript and the Next 16.2.12 production build through the
   installed `nextjshx` CLI;
4. verifies all expected static and generated-static routes;
5. starts each production server and drives critical behavior in Chrome at
   1440 × 1000 and 390 × 844; and
6. removes the dedicated Haxe output, Next build, compiled stylesheet, control
   directory, and only the adapter files named by the validated ownership
   manifest.

Set `NEXTJSHX_CHROME` to an absolute Chrome or Chromium executable when the
runner cannot find a standard system installation. The full public preflight
runs Gitleaks and the local-path guard before the root test reaches this lane.

## Sites

| Package | Product and visual direction | Routes and behavior |
| --- | --- | --- |
| `@nextjshx/showcase-landing` | Pelagic Signal, an editorial marine-instrument landing page | Static home page, typed self-link, shared UI, and a hydrated Haxe tide dial whose level and direction can be changed |
| `@nextjshx/showcase-blog` | Moraine, a restrained field journal with topographic geometry | Static index, three typed generated-static article routes, generated metadata, next-article navigation, and a segment-specific Haxe not-found view |
| `@nextjshx/showcase-commerce` | Common Ground, a bold small-space growing storefront | Static catalogue, three typed generated-static product routes, generated metadata, optimized product images, filtering, a hydrated quantity-aware cart Sheet, and a segment-specific Haxe not-found view |
| `@nextjshx/showcase-field-atlas` | Field Atlas, an editorial ecological research station with ledger grids and specimen labels | Haxe-owned home and portable briefing routes, native trusted MDX, a typed Haxe component registry, GFM tables, heading slugs, highlighted code, a hydrated Recharts signal plot, and closed remote-style content blocks |

The product names, addresses, inventory, and editorial content are fictional
and contain no production credentials or private data.

## Haxe, TSX, and shadcn ownership

Application behavior is Haxe-owned. The `.hx` trees contain page and layout
declarations, route params and hrefs, domain records and abstracts, HXX, static
params, metadata, not-found control flow, client-component declarations, and
event callbacks. Landing and commerce author their stateful Hooks in Haxe
through the semantic React surface. Commerce also publishes an ordinary typed
`useShopCart` client export, demonstrating Haxe-to-TypeScript reuse. Native
TypeScript-to-Haxe React interop lives in the dedicated Patchbay 06 adoption
example instead of supplying core behavior to a Haxe-first site.

These are executable adoption examples rather than illustrative snippets:

| Direction | Native or Haxe implementation | Typed consumer and proof |
| --- | --- | --- |
| Native TypeScript Hook → Haxe | `examples/mixed-adoption/native/use-signal.ts` | `mixed_adoption.native.NativeSignalHook` models the closed result and `HaxePatchConsole.hx` consumes it inside a hydrated Haxe Client Component. |
| Haxe Hook inside a Haxe Client Component | `landing.client.TideHook.useTideReading` | `TideDial.hx` consumes semantic Haxe state directly; no native Hook module or adapter is needed. |
| Source-owned TSX/shadcn → Haxe | `examples/showcase-ui/src/components/ui/*.tsx` and `src/icons.ts` | The matching `showcase.ui.*` Haxe facades preserve exact props, enum abstracts, callbacks, children, and Lucide spreads; all three sites exercise them through HXX. |
| Haxe Hook → ordinary TypeScript | `commerce.client.CartHook.useShopCart` | NextJsHx publishes a directive-first typed const alias at `app/_nextjshx/hook/.../useShopCart.ts`; strict TypeScript, Next, and the production browser exercise the same implementation. |
| Haxe Hook and component → native TSX | `SemanticHooks.hx`, `GenericHooks.hx`, and `InteractiveCounter.hx` in the Client Component fixture | `tests/client-components/next-app/app/haxe-hook-consumer.tsx` imports them like handwritten React modules and proves generic inference, closed props, children, Hook identity, and hydration. |
| Native App Router files beside generated routes | the fixture's handwritten `app/layout.tsx` and `app/haxe-hook-consumer.tsx` | Manifest-owned generated routes coexist without overwriting native files; the real production build validates one ordinary Next module graph. |

Public generated modules are intentionally small and native-looking: the
directive stays first, imports use one canonical ESM identity, exports are
ordinary named or default bindings, and there are no Haxe runtime values,
assertions, wrapper calls, or codegen-only helpers in the public adapter. The
showcase and Client Component runners inspect those invariants before invoking
strict TypeScript and Next.

The files under `examples/showcase-ui/src/components/ui/*.tsx` are TSX on
purpose. Current shadcn components are source distributions rather than an
opaque widget runtime: the application owns the copied React/Radix
implementation and can review or update it against upstream. Rewriting those
internals into Haxe would create a local shadcn fork and make common React
libraries harder to adopt. NextJsHx instead places a precise reusable Haxe
surface in `examples/showcase-ui/haxe/showcase/ui`; Haxe applications author
props with enum abstracts and exact records, while strict emitted TSX checks
the final JSX against the real source-owned component and library declarations.

Polymorphic composition gets a distinct Haxe identity instead of one
permissive prop bag. `SlottedButton`, `SlottedBadge`,
`SlottedSheetTrigger`, and `SlottedSheetClose` require the `asChild` property
and exactly one `genes.react.Element`, yet they import the same native exports
and emit the canonical `<Button asChild>` / `<SheetTrigger asChild>` TSX.
Direct `Slot` use has the same one-element contract. Text, omission, multiple
children, and wrong callbacks are exact Haxe-negative controls. See
[Radix and shadcn composition](radix-shadcn.md) for the boundary and its stated
limits.

That boundary is exercised, not assumed. The focused fixture contains:

```haxe
final icon:IconProps = {size: 16, strokeWidth: 1.5};
return <ArrowUpRight {...icon} />;
```

Haxe parses the HXX spread, genes-ts preserves `{...icon}`, and strict
TypeScript checks it against Lucide's component props. The paired malformed
`<ArrowUpRight {...} />` fixture must fail with
`Spread attribute missing expression`; an arbitrary Button size must also fail
against the closed `ButtonSize` abstract. There is no `Dynamic`, `Any`,
`untyped`, broad `unknown`, assertion, or unchecked cast escape in the authored
showcase boundary.

Compile-time string attributes use canonical HXX such as
`className="product-card"`, `id="cart-total"`, and `aria-label="Filter products"`.
Braces remain reserved for dynamic values such as generated hrefs, state, and
callbacks. The fast showcase source lane rejects a redundant static form such
as `className={"product-card"}` so examples and generated snapshots do not
drift back to noisier TSX.

## Exercised surface map

| NextJsHx or ecosystem surface | Landing | Blog | Commerce | Field Atlas | Focused UI contract |
| --- | :---: | :---: | :---: | :---: | :---: |
| `@:next.layout` and `LayoutProps` | ✓ | ✓ | ✓ | ✓ |  |
| `@:next.page` and typed `PageProps` | ✓ | ✓ | ✓ | ✓ |  |
| Generated `Page.href()` / typed `NextLink` | ✓ | ✓ | ✓ | ✓ |  |
| `@:next.clientComponent` and inferred `.client()` ref | Tide dial |  | Shop/cart | Signal plot |  |
| Haxe-authored semantic Hook | Tide state |  | Filter/cart state |  |  |
| Haxe-authored React 19 action/retry and recovery Hooks |  |  |  |  | Todo flagship |
| Dynamic route params with a domain abstract |  | `PostSlug` | `ProductSlug` |  |  |
| `generateStaticParams` |  | Three articles | Three products |  |  |
| `generateMetadata` |  | Article title/dek | Product title/tagline |  |  |
| Native `next/navigation.notFound()` flow |  | Missing article | Missing product |  |  |
| Segment-scoped `@:next.notFound` |  | Journal | Products |  |  |
| Semantic `NextImage` |  |  | Catalogue/detail |  |  |
| Source-owned shadcn Button | ✓ | ✓ | ✓ | ✓ | positive + invalid size |
| Source-owned shadcn Badge | ✓ | ✓ | ✓ | ✓ | positive |
| Source-owned shadcn Card family | ✓ | ✓ | ✓ | ✓ | positive |
| Source-owned shadcn Input |  |  |  |  | positive |
| Source-owned shadcn Textarea |  |  |  |  | positive |
| Source-owned shadcn Separator |  | ✓ |  |  | positive |
| Radix Slot / shadcn `asChild` exact composition | ✓ |  | Cart trigger/close |  | positive + text/missing/multiple-child negatives |
| Source-owned Radix/shadcn Sheet |  |  | Cart + focus/Escape/return-focus browser proof |  | positive + callback negative |
| Lucide icon typed spread | ✓ | ✓ | ✓ | ✓ | positive + syntax failure |
| Trusted native MDX + typed Haxe component registry |  |  |  | ✓ | exact registry negatives |
| Closed portable remote-content decoder and exhaustive renderer |  |  |  | ✓ | executable/malformed data negatives |
| Reviewed remark/rehype plugins |  |  |  | GFM, slugs, code | package drift controls |
| Responsive production-browser proof | ✓ | ✓ | ✓ | ✓ |  |

## JSX-safe Next component names

HXX should use `nextjs.components.NextLink`, `NextImage`, `NextForm`, and
`NextScript` when those values appear as tags. They are zero-wrapper extern
aliases of the exact public Next default imports and continue to use the raw
prop types. The distinct names prevent inline markup from confusing a
framework component with intrinsic `link`, `img`, `form`, or `script` tags—a
failure first exposed by the landing site's real prerender. The faithful raw
bindings remain available for low-level interop. See the
[binding policy](binding-policy.md#jsx-safe-semantic-component-values).

## Adding another maintained site

A new maintained site needs its own private workspace, exact dependency pins,
dedicated `src-gen` and `.nextjshx` roots, Haxe page/layout declarations, a
distinct responsive design, and at least one meaningful compiler or framework
surface not already demonstrated. Add its expected manifest-owned adapters,
prerendered routes, desktop/mobile critical flow, and surface-map entries to
the single runner. Keep app-specific visual composition local; move only truly
reusable UI primitives and precise bindings into `showcase-ui`.
