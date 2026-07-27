# Metadata, static params, and segment config

NextJsHx lets an annotated page or layout declare the reviewed Next.js named
exports beside its Haxe implementation. The Haxe macro validates the semantic
contract, records only closed adapter data, and leaves Next's generated route
types and TypeScript plugin as independent verifiers.

## Why this layer was needed

While developing the production Next fixture, the page/layout layer could type
`render` but deliberately rejected `metadata`, `generateMetadata`,
`generateStaticParams`, and segment config. A Haxe-owned page that needed one of
those features therefore also needed an application-owned TypeScript convention
file. That split made the route shape, implementation, and configuration two
sources of truth.

The work also exposed a framework-integration detail: Next 16.2.12 inspects
segment-config exports as syntax-level literals. A generic runtime builder or an
unnecessary TypeScript assertion would make that contract less transparent to
the framework plugin. NextJsHx now accepts only inline Haxe literals and renders
plain `export const` values. The marker is erased before genes-ts output, so the
feature adds compile-time ergonomics without a wrapper or configuration runtime.

Without this layer, the safe choices were to keep the named exports in native
TypeScript or to omit the behavior. A naive passthrough would instead risk
silently dropping an export, accepting a static-param shape that disagreed with
the route, or discovering an invalid config only during a later Next build.

## Reviewed declaration surface

An `@:next.page` or `@:next.layout` declaration may expose these public names:

| Haxe field | Required Haxe shape | Generated Next export |
| --- | --- | --- |
| `metadata` | `public static final metadata:Metadata = ...` | `export const metadata: Metadata` |
| `generateMetadata` | Public static, non-generic function | Exact route-aware metadata function |
| `generateStaticParams` | Public static, non-generic, zero-argument function | Exact route-aware static-param function |
| `segment` | `public static final segment = SegmentConfig.create({...})` | One direct literal export per config field |

`metadata` and `generateMetadata` are mutually exclusive. Unrecognized public
fields fail closed; ordinary implementation helpers should remain private.

## Positive: static metadata and literal config

```haxe
package app;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.app.SegmentRuntime;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

@:next.page("about")
class AboutPage {
  public static final metadata:Metadata = {
    title: "About",
    description: "Static metadata authored in typed Haxe."
  };

  public static final segment = SegmentConfig.create({
    runtime: SegmentRuntime.NodeJs,
    preferredRegion: "home",
    revalidate: false,
    maxDuration: 5
  });

  public static function render(
    props:PageProps<NoParams, SearchParams>
  ):Element {
    return <main>About</main>;
  }
}
```

The `Metadata` projection stays tied to Next's public root type. Nested metadata
fields are therefore checked by strict generated TypeScript rather than copied
into a second incomplete Haxe model.

## Positive: generated metadata and static params

```haxe
package app;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.PageMetadataProps;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.ResolvingMetadata;
import nextjs.route.SearchParams;

typedef ProductParams = {
  final slug:String;
}

@:next.page("products/[slug]")
class ProductPage {
  public static final segment = SegmentConfig.create({
    preferredRegion: ["iad1", "sfo1"],
    dynamicParams: false,
    revalidate: 60,
    maxDuration: 10
  });

  public static function generateMetadata(
    props:PageMetadataProps<ProductParams, SearchParams>,
    parent:ResolvingMetadata
  ):Promise<Metadata> {
    final value:Metadata = {
      title: "Generated product metadata"
    };
    return Promise.resolve(value);
  }

  public static function generateStaticParams():Promise<Array<ProductParams>> {
    return Promise.resolve([
      {slug: "first"},
      {slug: "second"}
    ]);
  }

  public static function render(
    props:PageProps<ProductParams, SearchParams>
  ):Element {
    return <main>Product</main>;
  }
}
```

The static-param element type must match every dynamic segment exactly. Missing,
extra, optional, or wrong-cardinality fields fail during Haxe typing. A fully
static route cannot declare `generateStaticParams`. The current reviewed
contract uses a zero-argument function and accepts either `Array<Params>` or
`Promise<Array<Params>>`.

For metadata props:

- `MetadataProps<Params>` is the safe page/layout common shape and exposes only
  Promise-shaped `params`;
- `PageMetadataProps<Params, SearchParams>` additionally exposes the page-only
  Promise-shaped `searchParams`; and
- an optional second argument must be exact `ResolvingMetadata`.

A layout cannot use `PageMetadataProps`, because Next does not supply layout
search params. Metadata functions return `Metadata` or `Promise<Metadata>`.

## Generated adapter

The generated page above remains ordinary Next.js TypeScript:

```tsx
import { ProductPage } from "../../../src-gen/app/ProductPage";
import type { Metadata } from "next";
import type { ResolvingMetadata } from "next";
import type { JSX } from "react";

const NextJsHxDefault:
  (props: PageProps<"/products/[slug]">) => JSX.Element =
  ProductPage.render;
export default NextJsHxDefault;

export const generateMetadata:
  (props: PageProps<"/products/[slug]">, parent: ResolvingMetadata) =>
    Promise<Metadata> =
  ProductPage.generateMetadata;

export const generateStaticParams:
  () => Promise<
    Array<Awaited<PageProps<"/products/[slug]">["params"]>>
  > =
  ProductPage.generateStaticParams;

export const dynamicParams = false;
export const maxDuration = 10;
export const preferredRegion = ["iad1", "sfo1"];
export const revalidate = 60;
```

There is no cast, `any`, runtime config object, or business logic in the
adapter. The route-literal `PageProps` comparison makes Next a second oracle for
both metadata inputs and static-param output.

## Supported segment fields

`SegmentConfig.create` is intentionally versioned to the reviewed stable Next
16.2.12 contract:

| Field | Accepted value |
| --- | --- |
| `runtime` | `SegmentRuntime.NodeJs`, `SegmentRuntime.Edge`, `"nodejs"`, or `"edge"` |
| `preferredRegion` | One non-empty trimmed string, or a non-empty literal array of unique strings |
| `dynamicParams` | Literal `true` or `false` |
| `revalidate` | Literal `false` or a non-negative integer number of seconds |
| `maxDuration` | A positive integer number of seconds |

The semantic `SegmentRuntime` omits `experimental-edge`; the raw Next binding
still reflects upstream separately. Accepting the stable `edge` spelling here
does not expand the support matrix into an Edge deployment claim: the required
production lane currently exercises Node.js, and Edge compatibility still
requires its own runtime audit.

Unknown or experimental fields fail instead of passing through. A plan that
contains config is also rejected if its recorded Next version is not exactly
16.2.12. Supporting another Next version requires reviewing its public plugin
contract and adding corresponding evidence.

Qualified lookalikes such as `foreign.api.SegmentConfig.create(...)` and
`foreign.api.SegmentRuntime.NodeJs` are also rejected. Only the semantic
NextJsHx marker path and its normal imported shorthand may disappear before
Haxe expression typing.

## Negative examples

These failures occur before a Next build and leave no accepted adapter plan.

Runtime configuration is not evaluated:

```haxe
static final options = {revalidate: 60};
public static final segment = SegmentConfig.create(options);
```

This fails with `NXHX-SEGMENT-CONFIG-0001`. Requiring an inline object prevents
an authoring-time value from becoming opaque runtime configuration.

`true` is not a meaningful Next revalidation interval:

```haxe
public static final segment = SegmentConfig.create({
  revalidate: true
});
```

This also fails with `NXHX-SEGMENT-CONFIG-0001`; use `false` or a non-negative
integer.

A static-param shape cannot disagree with its route:

```haxe
@:next.page("products/[slug]")
class BrokenProductPage {
  public static function generateStaticParams():Array<{final id:String;}> {
    return [{id: "first"}];
  }

  public static function render(
    props:PageProps<ProductParams, SearchParams>
  ):Element {
    return <main>broken</main>;
  }
}
```

The route validator reports the missing `slug` before publication. Returning
the right primitive types under the wrong field name is not accepted.

Static and generated metadata cannot compete:

```haxe
public static final metadata:Metadata = {title: "Static"};
public static function generateMetadata(
  props:MetadataProps<NoParams>
):Metadata {
  return {title: "Generated"};
}
```

This fails with `NXHX-PAGE-LAYOUT-METADATA-0008`. Invalid static-param function
shapes use `NXHX-PAGE-LAYOUT-STATIC-PARAMS-0009`.

## Compile-time and runtime boundaries

The page/layout build macro removes only the `segment` marker before genes-ts
generation. Metadata and function implementations remain normal typed Haxe
members because the adapter delegates to them. The adapter plan carries config
as tagged string, string-array, Boolean, or integer data; it never carries a
TypeScript expression.

The host renderer revalidates the closed export and config vocabulary before it
writes bytes. `nextjshx generate` then runs Next type generation and strict
TypeScript unless explicitly invoked with its documented `--no-check` escape;
`nextjshx build` additionally requires Next's own production TypeScript phase.

Run the focused and production evidence with:

```sh
npm run test:metadata-segment
npm run test:fixture:next-stable
npm run test:fixture:next-stable:smoke
```

The focused suite locks three positive declarations, fourteen exact negative
diagnostics, a schema-validated plan snapshot, compile-time marker erasure,
direct literal adapter output, and strict TypeScript. The stable fixture proves
static and generated `<title>` output, two prerendered Haxe slugs, and a real
404 for an omitted slug under `dynamicParams: false`.
