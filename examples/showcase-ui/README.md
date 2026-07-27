# Shared shadcn UI: native React, checked from Haxe

This private workspace is the design system shared by the examples. The shadcn,
Radix, cmdk, CVA, Tailwind, and Lucide implementations remain ordinary source
TSX. The parallel `haxe/showcase/ui` tree describes their precise Haxe surface.

## Why this split?

Keeping shadcn components native preserves its normal copy-and-own workflow and
ecosystem updates. Closed Haxe props add compile-time checking for variants,
sizes, callbacks, form controls, command payloads, and polymorphic children.
There is no wrapper component at runtime.

| Native source | Haxe view | Benefit |
| --- | --- | --- |
| `src/components/ui/*.tsx` | `haxe/showcase/ui/*.hx` | exact props and callbacks |
| Radix Slot composition | `Slotted*` identities | exactly one element child |
| cmdk components | `Command.hx` | typed selection and focus surface |
| Lucide icons | `Icons.hx` | reviewed named exports |

In a vanilla Next app, application TSX imports these components directly. HXX
does the same after Haxe validates the markup, so emitted code still looks like
handwritten `<Button>`, `<SheetTrigger>`, or `<CommandItem>`.

## The same component contract in vanilla TSX

The native shadcn component remains the source of runtime truth:

```tsx
type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ asChild, variant, size, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp className={buttonVariants({ variant, size })} {...props} />
}
```

NextJsHx does not wrap or replace it. The precise Haxe declaration projects the
same variants, callbacks, refs, and polymorphic child rules into HXX so invalid
usage fails at the Haxe call site while the emitted import retains the canonical
native module and React identity.

The Haxe side is a zero-runtime declaration, not another component:

```haxe
typedef SlottedButtonProps = {
	> ButtonAppearanceProps,
	final asChild:Bool;
	final children:Element;
}

@:jsRequire("@nextjshx/showcase-ui/button", "Button")
@:genes.jsxComponentProps("showcase.ui.Button.SlottedButtonProps")
extern class SlottedButton {}
```

This separate Haxe identity gives `asChild` an exact one-element child
contract. Both `UiButton` and `SlottedButton` still import the same native
`Button`, so Radix context and React identity are not duplicated.

## Verify it

```sh
npm run test:showcase-ui
```

The test compiles positive HXX, requires wrong props/callbacks/children to fail,
checks canonical TSX, and runs the native TypeScript and React lint contracts.

## Gotchas

- Update native shadcn source and its Haxe declaration together.
- `Slot`-backed components accept one React element, not arbitrary text or
  multiple children.
- Search text from cmdk is not automatically a trusted application command.

See [Radix/shadcn](../../docs/radix-shadcn.md) and
[cmdk](../../docs/cmdk.md) for the upgrade and ownership rules.
