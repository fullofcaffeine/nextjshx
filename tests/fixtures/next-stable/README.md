# Stable Next.js fixture

This is the Milestone 0 integration proof, not the eventual public example.
It compiles `haxe/app/HelloView.hx` through the exact Lix-locked genes-ts
revision, then imports the split TSX module from a deliberately hand-written
`app/page.tsx` adapter.

The build selects genes-ts's generic `genes.ts.jsx_import_source=react`
profile because React 19 exposes the `JSX` type namespace from its module
rather than relying on an ambient global.

`HelloView` is marked with narrow standard-Haxe `@:keep` metadata because its
only caller is the authored TypeScript adapter, which Haxe cannot discover or
count for DCE. The build includes the owning Haxe package so the module is
typed; `@:keep` then selects the external entry while full DCE stays enabled.
This uses genes-ts's documented application interop policy and does not execute
a fake Haxe call.

The verification command performs a clean Haxe compile, checks the generated
module/import shape, runs `next typegen`, runs strict TypeScript, and builds the
app with the pinned stable Next.js package. The smoke command starts that
production build on an ephemeral loopback port and verifies the rendered Haxe
content.

```sh
npx --no-install lix download
npm run test:fixture:next-stable
npm run test:fixture:next-stable:smoke
```

The root package overrides TypeScript's compatibility-wrapper core to the
documented 6.0.2 compiler and PostCSS to the audited 8.5.10 release. The
fixture verifies both resolutions before compiling, then proves the PostCSS
override remains compatible by completing a real Next production build.

`src-gen/`, `.next/`, `next-env.d.ts`, and TypeScript build metadata are
generated and intentionally untracked. The native layout and temporary page
adapter remain application-owned.
