# Typed npm package integrations

NextJsHx adopts React and Next.js ecosystem packages through a reviewed,
precise-or-omitted contract. The package remains the runtime. Haxe adds exact
externs and, where it materially improves authoring, a semantic facade that
uses fewer annotations and rejects invalid states earlier.

This workflow was added while planning the flagship Todo and architecture
showcases. Those applications need real URL state, polymorphic components,
accessible sorting, command flows, charts, and animation; one-off app-local
externs would be hard to audit, reuse, or upgrade safely.

## Current contract

The machine-readable inventory is
[`config/package-integrations.json`](../config/package-integrations.json). Each
record pins:

- npm package name and exact version;
- lockfile SHA-512 integrity;
- license and canonical upstream repository;
- every supported public module specifier;
- the declaration file selected by the package's ESM import condition;
- a SHA-256 of that declaration and each required public export;
- repository-owned Haxe/native sources; and
- executable evidence files.

Run the fast drift and contract lanes with:

```sh
npm run integrations:check
npm run test:integrations
```

The first command verifies the checked record against the installed tree and
lockfile. The second adds exact negative controls. Both are part of the root
test harness.

The current positive controls are `@radix-ui/react-slot` `1.3.0`, used by the
source-owned shadcn Button and Badge components;
`@radix-ui/react-dialog` `1.1.19`, used by the accessible Sheet; `cmdk` `1.1.1`,
used by the keyboard-first typed Todo command surface; `nuqs` `2.9.1`, used by
typed URL-state Hooks and the App Router adapter; and
`@dnd-kit/react`/`@dnd-kit/helpers` `0.5.0`, used by the accessible sortable
Todo list; Recharts `3.8.1`, used by the Todo priority runway and Field Atlas
signal plot; and the Field Atlas MDX stack: `@next/mdx` `16.2.12`,
`@mdx-js/loader`/`@mdx-js/react` `3.1.1`, `remark-gfm` `4.0.1`,
`rehype-slug` `6.0.0`, and `rehype-pretty-code` `0.14.5`. The MDX records pin
the build plugin and each configured transform independently, so an upgrade
cannot silently move a declaration entry or replace a reviewed export. The
full authoring contracts are in
[Radix and shadcn composition](radix-shadcn.md),
[Typed command surfaces with cmdk](cmdk.md),
[Typed URL state with nuqs](nuqs.md), and
[Accessible sortable interfaces with dnd-kit](dnd-kit.md),
[Typed planning charts with Recharts](recharts.md), and
[MDX and portable content](mdx-and-content.md).

## Choose the ownership strategy

Use the narrowest strategy that matches how the upstream package is normally
consumed:

| Strategy | Use it when | Output/runtime consequence |
| --- | --- | --- |
| `raw-extern` | Haxe can faithfully model a supported public export | Direct import and call; no wrapper |
| `semantic-facade` | Haxe can separate intent, infer types, or close invalid states | Compile-time API that lowers to the raw package operation |
| `native-source` + `haxe-facade` | The ecosystem expects application-owned TS/TSX, such as shadcn | Native source stays editable; Haxe sees exact props/functions |
| `generated-adapter` | A client directive, convention file, or stable public export is required | Small manifest-owned native module with no business logic |

Raw third-party bindings use
`nextjs.raw.integrations.<package>`. Semantic Haxe APIs use
`nextjs.integrations.<package>`. Shared source-owned components keep their own
package namespace, such as `showcase.ui`.

## Adoption workflow

1. Start from a real application need and the package's documented public
   module—not a private source path.
2. Record the current package version, license, integrity, repository, export
   map, selected declaration entry, and declaration digest.
3. List only the exports the integration will support. If an upstream type
   cannot be represented precisely, omit it and document the unsupported shape.
4. Add a faithful raw extern where direct host transfer is sound.
5. Add a semantic facade only when it reduces code or prevents a real footgun
   without changing package runtime semantics.
6. Add positive Haxe inference and output controls, exact negative Haxe
   controls, strict TypeScript, and category-appropriate browser behavior.
7. Prove both interop directions when the surface is meant for public reuse.
8. Add every owned source and evidence file to the integration record, then run
   the drift gate and full relevant application lane.

Do not execute package source during declaration discovery. Do not import a
private file because it has a simpler type. Do not translate an upstream
conditional type into `Dynamic`, `Any`, broad `unknown`, a cast, reflection, or
an assertion.

## Example: source-owned polymorphic component

The native Button keeps Radix Slot and shadcn composition in ordinary TSX:

```tsx
const Component = asChild ? Slot : "button"
return <Component {...props} />
```

Haxe consumes the package-owned export through a separate exact-child facade:

```haxe
return <SlottedButton variant={ButtonVariant.Outline} asChild>
	<a href="#work">Open work</a>
</SlottedButton>;
```

The Haxe-only identity still emits the ordinary native `<Button asChild>` tag;
it adds no React wrapper. It requires exactly one `genes.react.Element`, so
text, omission, and multiple children fail at the authored HXX span. Closed
variant strings, callback arguments, and spreads are checked there as well.
Strict TypeScript still independently validates the emitted TSX against the
real source-owned component and Radix declaration.

For example, this negative control never reaches TypeScript:

```haxe
<SlottedButton asChild>
	<a href="#one">One</a>
	<span>Two</span>
</SlottedButton>
```

## Example: semantic generic Hook shape

A generic URL-state package commonly exposes a tuple and a setter union. The
raw layer should preserve that host shape. The semantic Haxe layer may make the
author's intent explicit:

```haxe
final page = Nuqs.useQueryState("page", Parsers.integer(1));

page.value;
page.set(3);
page.update(previous -> previous + 1);
page.clear();
```

This keeps familiar state composition while avoiding a raw
`null | value | updater` call at every update. The implementation must still
return the package's real `Promise<URLSearchParams>` and preserve its history,
shallow-routing, and scroll behavior. The negative control passes a `String` to
the integer state and must fail in Haxe before TypeScript output exists.

## Upgrade workflow

For an upgrade, change the direct dependency pin and regenerate the npm lock,
then run `npm run integrations:check`. Its initial failure identifies the first
unreviewed version, integrity, declaration-entry, digest, or export change.
Review the new declaration and runtime changelog before updating the checked
record. Run the package fixture, strict Next build, and browser controls; record
why the update was needed and what changed.

Changing a digest merely to turn the gate green is not a review. If the new
declaration requires a compiler capability, reduce that capability to a generic
genes-ts case. Keep framework and package names out of the compiler change.

## What the shared checker deliberately does not claim

The checker proves installed identity and that reviewed exports/sources have
not drifted. It does not prove an upstream package is secure, accessible, free
of bugs, or appropriate for every app. Runtime, accessibility, bundle, license,
and application-policy review remain explicit evidence owned by each
integration and its consuming example.
