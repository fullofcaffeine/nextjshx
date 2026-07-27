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

`nextjshx init` preserves all existing native bytes. The manifest owns only the
three generated adapters under `app/_nextjshx` and `app/haxe-lab`.

## Run it

```sh
npm run test:example:mixed-adoption
npm run dev --workspace @nextjshx/mixed-adoption
```

## Gotchas

- `@:jsRequire` describes a reviewed native export; it does not copy or own it.
- A generated Haxe Hook must still be consumed from a Client Component.
- A native file collision blocks generation instead of being overwritten.
- This example contains TypeScript on purpose; Haxe-first apps do not require
  hand-authored TS adapters.

Start with `haxe/mixed_adoption/native/NativeSignal.hx` and
`app/native-bridge-deck.tsx` to see both interop directions.
