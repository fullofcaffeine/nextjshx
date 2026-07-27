# Shared showcase UI

This private workspace owns the reviewed shadcn/Radix source used by all three
maintained sites. The React component internals stay as source TSX so they can
track normal shadcn updates and compose directly with Radix, CVA, Tailwind, and
Lucide. The parallel `haxe/showcase/ui` tree is the application-facing Haxe
surface: closed variants and sizes, exact structural props, separate plain and
Slot-backed component identities, explicit Sheet callbacks, reusable
Input/Textarea form controls, an exact cmdk command surface, and no broad-type
or cast escape.

`Slot`, `SlottedButton`, `SlottedBadge`, `SlottedSheetTrigger`, and
`SlottedSheetClose` require exactly one `genes.react.Element`. Haxe therefore
rejects text, missing, or multiple polymorphic children before writing TSX,
while the ordinary components retain their intentionally broad renderable
children. Both Haxe identities still import the same native shadcn export, so
generated code looks like the normal handwritten `<Button asChild>` or
`<SheetTrigger asChild>` composition.

The source-owned Command components use cmdk directly. Haxe checks dialog
state, selection callbacks, keywords, and the opt-in Mod+K/focus extensions,
while application code keeps command identities and payloads closed. The
Field Ledger Todo app is the maintained semantic example; the shared package
does not turn cmdk search strings into application actions.

Run both sides of the contract from the repository root:

```sh
npm run test:showcase-ui
```

That command type-checks the source package, compiles a HXX consumer covering
every exported primitive, checks the emitted TSX, and requires invalid props,
callbacks, spreads, and polymorphic children to fail. The maintained commerce
browser flow separately proves focus entry, Escape dismissal, focus return,
and slotted close behavior against a production Next build.

See [Radix and shadcn composition](../../docs/radix-shadcn.md) and
[Typed command surfaces with cmdk](../../docs/cmdk.md) for the exact ownership
and type boundaries, and the
[showcase guide](../../docs/showcases.md#haxe-tsx-and-shadcn-ownership) for the
complete application suite.
