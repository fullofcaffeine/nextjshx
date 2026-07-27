# Shared showcase UI contract

This fixture keeps both halves of the Haxe-to-React contract executable:

- `SurfaceConsumer.hx` must parse as HXX, emit the reviewed component imports
  and spreads, erase Haxe-only polymorphic identities back to canonical native
  tags, and pass strict TypeScript checking against the source-owned shadcn and
  pinned Radix/cmdk packages. Nested component children retain the minimum
  compiler-owned `JSX.Element` locals needed to preserve HXX child-before-parent
  component evaluation; the fixture rejects a prettier direct nesting when it
  would reverse that observable order.
- `HxxNegative.hx` selects exact Haxe-first failures for unknown/missing/wrong
  props, callbacks, spreads, and children. Its Slot / `asChild` cases prove
  text, omission, and multiple children cannot satisfy a one-Element contract;
  plain and polymorphic Button identities cannot be mixed accidentally. Its
  Command cases prove selection callbacks, search aliases, and shortcut policy
  retain their exact `String -> Void`, `Array<String>`, and `Bool` contracts.
- `NegativeSpreadSyntax.hx` proves malformed HXX spread syntax is rejected by
  Haxe before TypeScript runs.
- `NegativeButtonSize.hx` proves reviewed literal-union props cannot be widened
  with arbitrary strings.

Every negative verifies that no rejected TSX file is committed. Strict
TypeScript is an independent parity oracle, not the first checker. The
source-owned Command module also passes official `react-hooks/rules-of-hooks`,
`react-hooks/exhaustive-deps`, and `react-hooks/purity` checks.

Run the focused contract from the repository root with
`npm run test:showcase-ui`. See
[`docs/radix-shadcn.md`](../../docs/radix-shadcn.md) and
[`docs/cmdk.md`](../../docs/cmdk.md) for the ownership models,
positive/negative examples, emitted output, and production focus behavior.
