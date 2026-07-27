# ADR 0004: Haxe-native React component authoring

- Status: Accepted
- Date: 2026-07-18
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-f34.5.8.1`, `nxhx-f34.5.8.2`,
  `nxhx-f34.5.8.3`, `nxhx-f34.5.8.6`, `nxhx-f34.5.8.7`,
  `nxhx-f34.5.8.8`
- Related PRD sections: 6.2, 12.1–12.4, 16.2, 17.2, 18

## Context

React and Next.js classify components through the module usage graph, not
through a permanent `ServerComponent` or `ClientComponent` base class. App
Router components are server-rendered by default. A module headed by
`"use client"` establishes a client entry, and every runtime dependency below
that entry joins the client graph. A component with no environment-specific
capability may be used below either graph.

ADR 0003 locks those semantics and selects native generated adapters for the
server-to-client edge. The first implementation made that edge safe, but its
application API exposes two code-generation details:

```haxe
@:next.clientComponent("components/TideDial")
class TideDial {}

final Tide = ClientComponent.ref(TideDial);
```

The author must choose an App-Router-relative generated filename and then call
a central ref helper. Neither fact belongs to the product domain. Moving the
Haxe type can leave a stale path string, two developers can choose colliding
targets, and completion starts from `ClientComponent` rather than the component
the author is trying to render.

### Why this decision was needed

While developing the landing, commerce, and todo showcases, every interactive
leaf repeated the path/ref ceremony even though the compiler already knew the
component's full type, props, caller module, App Router root, and generated
root. The same work also exposed a more important modeling risk: adding a
nominal `ServerComponent` type would imply that a reusable pure component has
one permanent environment, contrary to React's graph semantics.

The component layer should use Haxe to improve the experience that developers
often criticize in plain Next.js:

- make the exceptional client entry explicit while leaving server rendering
  as the default;
- remove duplicated generated paths and directives;
- keep exact props, children, and async return types visible to Haxe tooling;
- report known raw cross-boundary imports and unsupported Flight values at the
  Haxe source position;
- make the safe boundary discoverable from the component token; and
- retain strict TypeScript and `next build` as independent graph oracles.

The implementation cannot pretend to prove native TypeScript imports,
third-party conditional exports, bundler transforms, every Rule of Hooks, or
the complete React Flight protocol. Those remain explicit later evidence
layers rather than reasons to weaken types.

### Feasibility evidence

Two focused compiler probes constrained the syntax choice.

First, a build macro cannot inject `public static macro function client()`
onto the annotated component and then use that component as a macro class.
Haxe correctly rejects an `@:build` type used inside macro execution. A normal
injected inline method is also insufficient because caller-relative module
resolution would happen while typing the component definition, not the server
consumer.

Second, a static extension macro does preserve the required caller context:

```haxe
using nextjs.client.ClientComponent;

final Tide = TideDial.client();
```

The extension receives `TideDial` as the same typed expression accepted by the
existing ref macro. It can validate the annotation and render signature, infer
the internal adapter, compute the import relative to the consuming genes-ts
module, and return the exact `ComponentType<Props>`. The generated server
module has no value or type import of the raw implementation.

A second probe compiled a Haxe function returning `Promise<Element>` as a
native React 19 async component, placed it below the public React `Suspense`
component, and passed strict TypeScript. No custom async component runtime is
required.

### Compared authoring and emission shapes

The three viable implementation families differ at the application boundary:

| Family | Representative Haxe | Emitted/native edge | Decision |
| --- | --- | --- | --- |
| Explicit path and central ref | `@:next.clientComponent("components/TideDial")` plus `ClientComponent.ref(TideDial)` | Native default-export adapter at the authored path | Safe compatibility form, rejected as the primary UX |
| Inferred adapter and component extension | `@:next.clientComponent` plus `TideDial.client()` | The same native adapter under a deterministic private target | Selected primary contract |
| Direct compiler emission | generic genes-ts module directive on the implementation | The raw genes-ts class module becomes the client entry | Rejected until a generalized compiler shape satisfies ADR 0001 |

The direct-emission candidate would begin like this:

```haxe
@:genes.moduleDirective("use client")
class TideDial {
	public static function render(props:TideDialProps):Element {
		return <button>{props.station}</button>;
	}
}
```

genes-ts can correctly preserve the generic directive before imports, but its
ordinary module shape remains approximately:

```tsx
"use client";

export class TideDial {
  static render(props: TideDialProps): JSX.Element {
    return <button>{props.station}</button>;
  }
}
```

That is not equivalent to exporting `TideDial.render` as the native
module-level React component entry. A server import of the class and selection
of its nested static method would reintroduce the unsafe raw edge. The selected
adapter supplies the missing directive-first default export without teaching
genes-ts about Next.js or changing the public Haxe component contract.

## Decision

### Component categories follow usage, not inheritance

NextJsHx does not introduce a `ServerComponent` base class, a permanent
environment generic, or a component registry. It uses these authoring shapes:

| Shape | Haxe signal | Meaning |
| --- | --- | --- |
| Server-local reusable component | ordinary class or function | Reached only from the server graph; may be synchronous or async and may use supported server APIs |
| Neutral reusable component | `@:next.shared` module when cross-graph reuse is intentional | May be imported below server and client entries; must remain shared-pure |
| Client entry component | `@:next.clientComponent` with a synchronous `render` | Owns one generated `"use client"` adapter; server consumers use the typed `.client()` extension |
| Component already below a client entry | ordinary direct client-to-client Haxe import | It is already in the client graph; no second boundary is required |
| Native TypeScript or package component | exact extern/raw import | Keeps the native module's own server/client contract; wrap it in a Haxe client entry when its package does not provide a reliable boundary or Haxe-owned hooks are added |

An unannotated component is not declared universally safe. It inherits the
graph of each runtime importer. `@:next.shared` is the explicit promise used
when the same module is intentionally imported from both sides, as selected by
ADR 0003.

### Server Components remain the zero-ceremony default

A reusable synchronous Server Component is an ordinary precisely typed Haxe
function. The local capitalized alias is the value consumed by HXX/TSX:

```haxe
typedef ProductSummaryProps = {
	final name:String;
	final price:String;
}

class ProductSummary {
	public static function render(props:ProductSummaryProps):Element {
		return <article><h2>{props.name}</h2><p>{props.price}</p></article>;
	}
}

@:next.page("products/[slug]")
class ProductPage {
	public static function render(props:PageProps<ProductParams, SearchParams>):Element {
		final Summary = ProductSummary.render;
		return <Summary name={"Field press"} price={"$128"} />;
	}
}
```

There is no server annotation because adding one would repeat Next's default
and encourage false nominal reasoning. If `ProductSummary` is intentionally
used by a Client Component too, its module adds `@:next.shared` and the
boundary audit requires its dependencies to remain shared-pure.

### Client entry declarations infer their adapter

The primary Client Component declaration has no path argument:

```haxe
typedef TideDialProps = {
	final station:String;
	final initialLevel:Int;
	final children:ReactNode;
}

@:next.clientComponent
class TideDial {
	public static function render(props:TideDialProps):Element {
		final reading = TideHook.useReading(props.initialLevel);
		return <section>
			<button type={"button"} onClick={reading.raise}>Raise</button>
			<strong>{reading.level}</strong>
			<div>{props.children}</div>
		</section>;
	}
}
```

The macro derives one internal target from the full Haxe type identity. The
canonical scheme is:

```text
_nextjshx/client/<first-12-lowercase-SHA256(full-type-name)>/<type-name>.tsx
```

For `landing.client.TideDial`, the target is:

```text
_nextjshx/client/6846cd673a8e/TideDial.tsx
```

The target is relative to the discovered App Router root. Next documents in
its [project-structure reference](https://nextjs.org/docs/app/getting-started/project-structure#private-folders)
that an underscore-prefixed App Router folder is private and excluded from
routing, so the internal tree cannot become a URL segment. The hash prevents package,
case-insensitive filesystem, reserved-name, and secondary-type ambiguity; the
leaf preserves useful diagnostics. The complete source identity remains in the
adapter plan and generated header rather than being inferred back from the
path.

The path is deterministic, versioned as part of the adapter-plan contract, and
validated through the same ownership transaction as every convention adapter.
An existing unowned file is a collision, not permission to overwrite it.

### The component token exposes the safe boundary

A server consumer opts into the extension once and asks the component it
already knows for its client entry:

```haxe
package landing.app;

import landing.client.TideDial;
using nextjs.client.ClientComponent;

@:next.page("")
class HomePage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final Tide = TideDial.client();
		return <Tide station={"PS-07"} initialLevel={62}>
			<span>Server-rendered child</span>
		</Tide>;
	}
}
```

`TideDial.client()` is a compile-time expansion, not a runtime method on the
component. It accepts only one validated `@:next.clientComponent` class token,
returns `nextjs.raw.react.ComponentType<TideDialProps>`, and uses a TypeScript
type query against the generated adapter as an independent emitted-type check.
Calling `.client()` on an ordinary, server-only, shared, or malformed class
fails at that call site.

The explicit `using` is deliberate. It keeps the cross-boundary operation
visible in a server module without requiring a central helper call or silently
installing a project-wide prelude.

The generated client adapter remains ordinary Next.js code:

```tsx
"use client";

import { TideDial } from "../../../../src-gen/landing/client/TideDial";
import type { ComponentType } from "react";

const NextJsHxDefault: ComponentType<
  Parameters<typeof TideDial.render>[0]
> = TideDial.render;

export default NextJsHxDefault;
```

The generated server implementation imports only that adapter:

```tsx
import __genes_import_NextJsHxClientda772c39176f from "../../../app/_nextjshx/client/6846cd673a8e/TideDial"

let Tide: import("react").ComponentType<
  Parameters<typeof import("../../../app/_nextjshx/client/6846cd673a8e/TideDial").default>[0]
> = __genes_import_NextJsHxClientda772c39176f

return <Tide station="PS-07" initialLevel={62}>
  <span>Server-rendered child</span>
</Tide>;
```

It does not import `landing.client.TideDial`. The adapter is the native client
entry and Next remains responsible for creating the final client graph.

### Client-to-client composition does not manufacture another boundary

Once a Haxe module is below a validated client entry, it may directly compose
another client implementation or a shared-pure component:

```haxe
@:next.clientComponent
class CheckoutIsland {
	public static function render(props:CheckoutProps):Element {
		final Quantity = QuantityPicker.render;
		final Price = SharedPrice.render;
		return <section>
			<Quantity value={props.quantity} />
			<Price cents={props.totalCents} />
		</section>;
	}
}
```

`QuantityPicker` is reached through the existing client graph. `SharedPrice`
may be `@:next.shared` if server code imports it too. Calling
`QuantityPicker.client()` here is allowed but unnecessary and should be
reported as redundant by the later component explainer; it must not change
runtime semantics.

### Children and named slots are ReactNode composition

Server-rendered content crosses a client entry as `ReactNode`, not as an
importable Server Component function:

```haxe
typedef ResizableShellProps = {
	final sidebar:ReactNode;
	final children:ReactNode;
}

@:next.clientComponent
class ResizableShell {
	public static function render(props:ResizableShellProps):Element {
		final size = ResizeHook.usePanelSize();
		return <div data-size={size}>
			<aside>{props.sidebar}</aside>
			<main>{props.children}</main>
		</div>;
	}
}

final Shell = ResizableShell.client();
final sidebar:Element = <ServerFilters />;
return <Shell sidebar={sidebar}><ServerResults /></Shell>;
```

The client implementation receives renderable values. It cannot import or
invoke `ServerFilters` or `ServerResults`. The existing conservative boundary
validator accepts the named `ReactNode` capability and rejects an ordinary
component callback.

### Async Server Components use native Promise and Suspense semantics

A reusable async Server Component is still ordinary Haxe server code:

```haxe
class InventoryPanel {
	@:async
	public static function render(props:InventoryProps):Promise<Element> {
		final items = await(Inventory.load(props.category));
		return <InventoryList items={items} />;
	}
}

final Inventory = InventoryPanel.render;
final suspense:SuspenseProps = {fallback: <p>Loading inventory...</p>};
return <Suspense {...suspense}>
	<Inventory category={"field-tools"} />
</Suspense>;
```

genes-ts emits a normal `async` function returning
`Promise<JSX.Element>`. React and Next own suspension, streaming, retries, and
render scheduling. A `@:next.clientComponent` render remains synchronous; an
async client render fails with `NXHX-CLIENT-RETURN-0004`.

For segment-level rejection, normal Next error composition remains explicit:

```haxe
@:next.error("catalog")
class CatalogError {
	public static function render(props:ErrorProps):Element {
		return <button onClick={_ -> props.reset()}>Retry catalog</button>;
	}
}
```

`Suspense` handles pending work and `error.tsx` handles thrown/rejected segment
work. NextJsHx does not translate server errors into return values or recommend
wrapping React `use` in `try/catch`. Typed server-to-client Promise composition
is separately gated by `nxhx-f34.5.8.6` and `nxhx-f34.5.8.7`.

### Third-party client libraries use a narrow Haxe-owned leaf

When a native library's component entry is already correctly marked for
React, its precise extern can be used directly. When the package is not a
reliable boundary, or Haxe-owned hooks and prop normalization are needed, wrap
it at a leaf:

```haxe
@:jsRequire("@nextjshx/showcase-ui/sheet", "Sheet")
extern class NativeSheet {}

typedef CartSheetProps = {
	final cartId:String;
	final trigger:ReactNode;
}

@:next.clientComponent
class CartSheet {
	public static function render(props:CartSheetProps):Element {
		final cart = CartHook.useCart(props.cartId);
		return <NativeSheet>{props.trigger}<CartLines lines={cart.lines} /></NativeSheet>;
	}
}
```

Server code renders `CartSheet.client()`. This keeps the client boundary at the
interactive leaf and gives Haxe one precise props/Flight contract. It does not
copy the library, replace its runtime, or claim that Haxe can inspect all of
its transitive dependencies.

### Native TypeScript interop remains bidirectional

Haxe may consume a native component through an exact package or application
extern:

```haxe
typedef NativeRatingProps = {
	final value:Int;
	final label:String;
}

@:jsRequire("@app/native-rating", "Rating")
extern class NativeRating {}

return <NativeRating value={4} label={"Field score"} />;
```

The native module owns whether it is server, shared, or client. If its contract
requires client behavior but it does not provide a trustworthy directive
entry, the Haxe wrapper above is required.

Native TypeScript may import the manifest-owned client adapter directly when a
mixed application needs the reverse edge:

```tsx
import TideDial from "../_nextjshx/client/6846cd673a8e/TideDial";

export function NativePanel() {
  return <TideDial station="PS-07" initialLevel={62}>Native child</TideDial>;
}
```

That is the documented raw interop escape: the target is deterministic and
read-only, and ownership remains with NextJsHx. Haxe application code should
use `.client()` so it never spells this path. A native module already below a
client entry may instead import a shared/client raw genes-ts implementation
when it intentionally accepts that lower-level shape.

### Positive and negative boundary behavior

Positive Haxe:

```haxe
using nextjs.client.ClientComponent;

final Counter = CounterIsland.client();
return <Counter initialCount={2}>Typed child</Counter>;
```

Haxe validates the declaration, props shape, and known graph edge. The emitted
adapter contains the directive and exact component signature. Strict
TypeScript, `next build`, and hydration validate the complete supported path.

Negative control without the semantic boundary:

```haxe
final Counter = CounterIsland.render;
return <Counter initialCount={2}>Bypassed boundary</Counter>;
```

In a server module this would make genes-ts emit a raw implementation import.
It bypasses the generated `"use client"` entry and may pull hooks or browser
dependencies into the wrong graph. NextJsHx rejects the known edge with
`NXHX-BOUNDARY-IMPORT-0002` before publication and points to
`CounterIsland.client()`.

An unannotated token also fails:

```haxe
final Summary = ProductSummary.client();
```

The diagnostic explains that `ProductSummary` is ordinary server/shared code,
not a declared client entry. Adding the annotation is correct only if the
module genuinely needs a client boundary; otherwise the author should use
`ProductSummary.render` directly.

These early errors improve plain Next.js authoring, but they do not replace a
native negative. A third-party client dependency importing `next/headers`, a
native TypeScript file bypassing the adapter, or a conditional export chosen
only by the bundler must still fail strict TypeScript or `next build`.

### Compatibility and migration

The selected implementation preserves both existing spellings as controlled
compatibility paths:

- `ClientComponent.ref(TideDial)` resolves the same inferred target as
  `TideDial.client()` and remains available for code that has not adopted the
  extension import;
- `@:next.clientComponent("explicit/path")` remains a validated explicit
  placement override for mixed applications that already expose a stable
  native import; and
- new examples and generated initialization use zero-argument metadata plus
  `.client()`.

The ordinary migration is mechanical:

```diff
-import nextjs.client.ClientComponent;
+using nextjs.client.ClientComponent;

-@:next.clientComponent("components/TideDial")
+@:next.clientComponent
 class TideDial {}

-final Tide = ClientComponent.ref(TideDial);
+final Tide = TideDial.client();
```

When the target changes from an explicit legacy path to the inferred private
path, one publication transaction creates the new adapter, updates consumers,
removes only the old manifest-owned adapter, validates the complete tree, and
replaces the manifest last. A modified or unowned old file blocks migration.

Explicit placement is never inferred from an existing file and is not the
default shown by documentation or initialization. The component explainer in
`nxhx-f34.5.8.8` reports inferred versus explicit placement so exceptional
native dependencies stay visible.

### Enforcement and evidence split

| Layer | Evidence owned by that layer |
| --- | --- |
| Haxe component macro | zero/one validated metadata path; concrete non-generic owner; exact one-prop synchronous client render; precise props; conservative Flight validation; source-positioned raw edge rejection |
| `.client()` extension macro | annotated class token; caller-relative adapter import; exact `ComponentType<Props>`; no emitted implementation token or runtime helper |
| Adapter plan and publisher | deterministic private target; one directive-first default export; collision/DCE/source identity; manifest ownership; atomic migration and rollback |
| genes-ts output | stable component identity/import aliasing; native TSX; precise Promise and props output; no Next-specific compiler behavior |
| Strict TypeScript and Next | JSX compatibility, native and package declarations, complete server/client graph, React Server Component transforms, route/error conventions, production bundle behavior |
| Browser/runtime evidence | server-rendered children, hydration, interaction, Suspense replacement, error reset, no client console/request failures, and no secret in client artifacts |

The implementation Beads require positive and negative Haxe fixtures,
deterministic adapter and implementation snapshots, strict TypeScript with
library checking enabled, pinned Next production builds, and browser behavior.
No layer may replace an unavailable proof with `Dynamic`, `Any`, broad
`unknown`, `untyped`, a suppression, an unchecked cast, or an edited `.next`
artifact.

## Consequences

Positive consequences:

- Server Components and reusable server helpers keep zero boundary ceremony.
- Client intent remains explicit, while generated placement and directive
  strings disappear from ordinary Haxe source.
- `TideDial.client()` is discoverable from the component token and retains the
  exact caller-sensitive import that made `ClientComponent.ref` safe.
- Neutral components are modeled as usage-graph members rather than nominally
  assigned to one environment.
- Async server rendering, Suspense, children, slots, error files, native
  components, and third-party wrappers lower to public React/Next primitives.
- Existing applications can migrate transactionally without an all-at-once
  compatibility break.

Costs and limits:

- Server modules need one explicit `using nextjs.client.ClientComponent` to
  enable extension syntax.
- JSX/HXX plus strict TypeScript remains an important independent props oracle;
  the Haxe layer cannot see every native spread or third-party declaration.
- Inferred adapter paths are intentionally implementation details. Native
  TypeScript reverse imports can use them, but thereby choose the documented
  raw interop surface.
- The conservative Flight allowlist remains narrower than React until each
  additional capability has exact types and runtime evidence.
- Haxe-aware Hook/purity diagnostics now cover explicitly reviewed Hook
  identities, React `use`, early local control flow, two known non-idempotent
  calls, and direct static mutation. They deliberately do not claim whole-
  program effects, dependency arrays, or transitive native JavaScript;
  clientification reports remain separate implementation work.

## Rejected alternatives

### Keep explicit path strings and central refs as the primary API

This is safe but needlessly exposes adapter placement, duplicates information
the compiler owns, weakens discoverability, and made every showcase repeat
non-domain ceremony. It remains only a compatibility/exceptional path.

### Inject `Component.client()` as a macro field on each component

Haxe rejects using the same `@:build` component as a macro class. An inline
field also computes caller-relative state in the wrong typing context. The
static extension provides the same call shape without relying on invalid or
fragile compiler behavior.

### Add nominal ServerComponent and ClientComponent base classes

React classification belongs to module usage. A pure component can enter both
graphs, while one client entry moves its dependency closure client-side. Base
classes would misrepresent that model, complicate composition, and invite a
parallel runtime.

### Emit the client boundary directly from genes-ts

genes-ts can emit generic module directives, but the current Haxe class output
exports a class whose nested static `render` is not the native module-level
default component export required by the selected boundary. Teaching the
general compiler Next-specific export and App Router placement policy would
couple it to this repository. A generalized future compiler capability may be
reevaluated only if it satisfies ADR 0001's direct-emission criteria and keeps
the same public Haxe contract.

### Infer client intent from Hooks or imported packages

Hook names, transitive native packages, and conditional exports are not a
sound declaration of a module entry. Silent inference could clientify a large
server subtree or miss an aliased/custom Hook. Client entry metadata remains
explicit; the typed Hook diagnostics explain locally provable mistakes without
changing the graph automatically.

### Generate a custom component, serialization, or HMR runtime

React, React Flight, Next's client manifest, Suspense, error boundaries, and
Fast Refresh already own these semantics. A second runtime would be harder to
debug, less compatible with native packages, and unable to improve the final
framework oracle. NextJsHx generates only narrow native adapters and
compile-time ergonomics.
