# Gradual adoption in an existing Next.js application

The [Patchbay 06 example](../examples/mixed-adoption/) starts with native
TypeScript App Router source and adds Haxe without changing Next.js's runtime,
router, build, or ownership model. It is intentionally separate from the
Haxe-first landing, blog, commerce, and Todo applications.

Run the complete evidence:

```sh
npm run test:example:mixed-adoption
```

## Scenario 1: preserve the existing application

Run `nextjshx setup` from the existing package. Setup inspects the native
`app/layout.tsx`, `app/page.tsx`, Client Component, Hook, and module, but never
claims them. Existing scripts and executable `next.config.mjs` are likewise
preserved.

The example hashes every reviewed native source, `app/environment.d.ts`,
`.gitignore`, `next.config.mjs`, NextJsHx/Haxe configuration, `tsconfig.json`,
and `package.json` before setup and requires the same hashes afterward. A
native `app/haxe-lab/page.tsx` collision separately proves that generation
fails closed rather than replacing the file.

## Scenario 2: render a native TSX component from Haxe

Describe only the supported props:

```haxe
typedef NativeSignalCardProps = {
	final channel:NativeSignalChannel;
	final label:String;
	final reading:String;
	final band:NativeSignalBand;
	final onCalibrate:Void->Void;
}

@:jsRequire("@nextjshx/mixed-adoption/native-component", "NativeSignalCard")
@:genes.jsxComponentProps("mixed_adoption.native.NativeSignal.NativeSignalCardProps")
extern class NativeSignalCard {}
```

HXX now checks required props, closed literal domains, and the callback before
emitting the direct native component import. The extern has zero runtime cost
and does not take ownership of `native/signal-card.tsx`.

## Scenario 3: call a native Hook and ordinary module from Haxe

The Hook extern carries `@:next.hook`, so Haxe's Hook placement diagnostics
recognize its identity through aliases. Its result is one closed immutable
record. The ordinary module uses enum abstracts for its units and result band:

```haxe
final reading = NativeSignalHook.use(props.initialLevel);
final formatted =
	NativeSignalFormat.formatSignal(reading.value, NativeSignalUnit.Db);
final band = NativeSignalFormat.signalBand(reading.value);
```

No adapter is generated for either import. TypeScript remains the source and
runtime owner.

## Scenario 4: render a Haxe Client Component from native TSX

`@:next.clientComponent` publishes a directive-first default adapter with an
exact props type:

```ts
"use client";

import { HaxePatchConsole } from "../../../../src-gen/mixed_adoption/client/HaxePatchConsole";
import type { ComponentType } from "react";

const NextJsHxDefault:
  ComponentType<Parameters<typeof HaxePatchConsole.render>[0]> =
  HaxePatchConsole.render;

export default NextJsHxDefault;
```

The adapter exists because Next and React attach meaning to the client
directive and component export shape. It delegates no wrapper call and remains
manifest-owned.

## Scenario 5: consume a generic Haxe Hook from native TSX

`@:next.exportHook` publishes a typed const alias:

```ts
"use client";

import { HaxeHooks } from "../../../../src-gen/mixed_adoption/client/HaxeHooks";

export const useBridgeChannel:
  typeof HaxeHooks.useBridgeChannel =
  HaxeHooks.useBridgeChannel;
```

`typeof` preserves generic inference. The alias adds no Hook call, frame, or
second React identity. Official React Hook lint checks both authored TSX and
the generated Haxe implementation.

## Scenario 6: consume an ordinary Haxe function from TypeScript

A plain function needs neither a React adapter nor a Next convention module:

```haxe
@:expose
function haxeInteropLabel(channel:String):String {
	return channel.toUpperCase() + " / VERIFIED BY HAXE";
}
```

genes-ts emits a named ESM export, and `@:expose` records the external DCE root.
Native TypeScript imports it from the deterministic Haxe entry module.

## Boundary failures are useful

The positive example keeps callbacks inside the client graph. Its paired Haxe
negative declares an ordinary function prop on a generated Client Component
boundary and must fail with `NXHX-SERIALIZABLE-PROP-0001`: arbitrary functions
cannot cross React Flight.

The native negative calls the generated Haxe state Hook from a Server
Component and must fail the real Next production build. The correction is not
a cast or directive inserted by codegen; move the Hook call into a deliberate
`"use client"` leaf.

These controls explain the ownership split:

- externs describe native values without runtime wrappers;
- adapters encode framework-required directives and export conventions;
- the manifest owns only generated convention modules; and
- Haxe and TypeScript source can coexist anywhere else under normal Next.js
  rules.
