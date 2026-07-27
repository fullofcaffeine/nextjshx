# Patchbay 06: mixed Next.js and Haxe adoption

Patchbay 06 is deliberately not Haxe-first. It begins with reviewed native
App Router source and adopts NextJsHx one explicit boundary at a time. The
finished application remains one ordinary Next.js module graph:

- `/` is a source-owned TypeScript Server Component;
- `/haxe-lab` is a manifest-owned Haxe page;
- each route renders one smallest hydrated leaf; and
- native and generated files remain under separate ownership.

The visual direction is an analog broadcast patchbay: editorial cream,
graphite, signal green, cobalt, and vermilion. It uses the repository's
source-owned shadcn components while keeping application composition local.

## Run it

From the repository root:

```sh
npm run test:example:mixed-adoption
npm run dev --workspace @nextjshx/mixed-adoption
```

The test lane checks native-byte preservation under `nextjshx init`, exact
generated adapter identities, strict Haxe and TypeScript, official React Hook
lint, route ownership, production Next output, and browser behavior.

## Native TypeScript consumed from Haxe

The `native/` directory is ordinary application source:

| Native source | Closed Haxe view | Runtime cost |
| --- | --- | --- |
| `signal-card.tsx` React component | `NativeSignalCard` plus exact props | none; HXX emits the native component |
| `use-signal.ts` custom Hook | `NativeSignalHook.use` plus closed result | none; Haxe calls the native Hook |
| `signal-format.ts` module | `NativeSignalFormat` plus enum-backed inputs/results | none; direct ESM calls |

`@:jsRequire` describes the reviewed export. It does not copy, wrap, or take
ownership of the native implementation. HXX validates every required prop and
callback at the Haxe source span before TypeScript output exists.

## Haxe consumed from native TypeScript

The reverse direction uses the smallest mechanism appropriate to the value:

| Haxe source | Native consumer | Publication mechanism |
| --- | --- | --- |
| `HaxePatchConsole.render` | `app/native-bridge-deck.tsx` | directive-first manifest-owned Client Component adapter |
| `HaxeHooks.useBridgeChannel` | `app/native-bridge-deck.tsx` | directive-first typed const alias preserving generic inference |
| `haxeInteropLabel` | `app/native-bridge-deck.tsx` | genes-ts `@:expose` named ESM export rooted for DCE |

Components and Hooks need adapters because React/Next attach meaning to module
directives, default exports, and `use...` identities. The ordinary pure
function needs none: native TypeScript imports the generated named export
directly.

## Ownership and boundary controls

`nextjshx init` is run against the existing package and must leave
`app/layout.tsx`, `app/page.tsx`, `app/native-bridge-deck.tsx`, and every
`native/*` module byte-identical. The same digest check covers the ambient
declaration, executable Next config, NextJsHx/Haxe and TypeScript config,
`.gitignore`, and `package.json`, including its existing scripts. `generate`
owns only:

```text
app/_nextjshx/client/c7daa5458af6/HaxePatchConsole.tsx
app/_nextjshx/hook/4aa28d4a55e4/useBridgeChannel.ts
app/haxe-lab/page.tsx
```

A native collision at `app/haxe-lab/page.tsx` blocks publication instead of
being overwritten. A Server Component that calls the generated Haxe Hook is
an invalid boundary and the negative production control must fail; moving that
use behind a `"use client"` leaf is the correction.

No TypeScript file is required to make Haxe-first applications work. This
example contains native TypeScript because its purpose is incremental adoption
inside an existing Next.js application.
