# Patchbay 06: add Haxe to an existing Next app

Patchbay begins as an ordinary TypeScript App Router project. It adopts
NextJsHx one boundary at a time without rewriting native pages, components, or
Hooks.

## What it proves

- native TSX page → native TSX at `/`;
- Haxe page → generated Next adapter at `/haxe-lab`;
- native component, Hook, and module → precise Haxe externs;
- Haxe component, Hook, and pure module → typed TypeScript consumers;
- one React/Next module graph, not two applications.

## Why Haxe helps

The interop declarations turn reviewed JavaScript exports into closed props,
results, and enums. HXX reports wrong native component props at the Haxe source.
In the reverse direction, generated exports preserve Hook naming, generic
inference, client directives, and normal ESM identity.

## Architecture versus vanilla Next.js

| Area | Native owner | Haxe owner |
| --- | --- | --- |
| routes | `app/page.tsx` | `HaxeLabPage.hx` |
| browser UI | `native/signal-card.tsx` | `HaxePatchConsole.hx` |
| Hooks | `native/use-signal.ts` | `HaxeHooks.hx` |
| pure modules | `native/signal-format.ts` | generated named Haxe export |

`nextjshx setup` preserves all existing native bytes. The manifest owns only the
three generated adapters under `app/_nextjshx` and `app/haxe-lab`.

## The same boundaries in vanilla TypeScript and Haxe

The native Hook is ordinary TypeScript and remains owned by the existing app:

```tsx
"use client"

export function useNativeSignal(initialValue: number): NativeSignalReading {
  const [value, setValue] = useState(initialValue)
  return {
    value,
    raise: () => setValue(current => current + 4),
    lower: () => setValue(current => current - 4),
  }
}
```

Haxe consumes that exact export through a declaration-only extern:

```haxe
extern class NativeSignalHook {
	@:next.hook
	@:jsRequire("@nextjshx/mixed-adoption/native-hook", "useNativeSignal")
	static function use(initialValue:Int):NativeSignalReading;
}

final reading = NativeSignalHook.use(props.initialLevel);
```

There is no wrapper or copied Hook. `@:jsRequire` preserves the canonical ESM
identity, while the closed result type and `@:next.hook` let Haxe check member
access and Hook placement before emitting the ordinary import/call.

The reverse direction is also executable today: native
`app/native-bridge-deck.tsx` imports the generated Haxe Client Component, Hook,
and function with their preserved types and identities. The current proof uses
manifest-owned private adapter paths, which is adequate for compiler evidence
but not an ergonomic public application API. The intended consumer contract is
a stable barrel such as:

```tsx
import { HaxePatchConsole, useBridgeChannel } from "@app/haxe/patchbay"
```

Stable named public barrels are tracked product work; this README does not
claim that shorthand is implemented yet. Until then, copy the example only as
an interop proof, not as the recommended import contract for an application.

## Run it

```sh
npm run test:example:mixed-adoption
npm run dev --workspace @nextjshx/mixed-adoption
```

## Gotchas

- `@:jsRequire` describes a reviewed native export; it does not copy or own it.
- A generated Haxe Hook must still be consumed from a Client Component.
- The current Haxe-to-TS imports are private generated identities; stable
  application-facing public modules remain planned.
- A native file collision blocks generation instead of being overwritten.
- This example contains TypeScript on purpose; Haxe-first apps do not require
  hand-authored TS adapters.

Start with `haxe/mixed_adoption/native/NativeSignal.hx` and
`app/native-bridge-deck.tsx` to see both interop directions.
