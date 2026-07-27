# Radix and shadcn composition from Haxe

NextJsHx keeps shadcn's application-owned React source intact and places a
closed Haxe authoring surface in front of it. Radix remains the headless
runtime for composition, focus management, portals, dismissal, and ARIA
behavior; Haxe adds earlier prop, callback, spread, and child diagnostics.

This boundary was hardened while building the commerce showcase. Its cart uses
a shadcn Sheet, while Button and Badge use Radix Slot's `asChild` protocol. A
plain `children:ReactNode` facade would have accepted text or several children
even though Slot needs one React element. The resulting failure would appear
late in a browser. The reviewed Haxe facade now states the locally provable
contract directly.

## Owned layers

| Layer | Repository source | Responsibility |
| --- | --- | --- |
| Radix/runtime packages | `@radix-ui/react-slot` 1.3.0, `@radix-ui/react-dialog` 1.1.19, and `cmdk` 1.1.1 | Slot prop merging, Dialog/Sheet state, command filtering and selection, portal, overlay, focus trap, Escape dismissal, and focus restoration |
| Source-owned shadcn | `examples/showcase-ui/src/components/ui/*.tsx` | Editable visual composition, Tailwind classes, CVA variants, and the normal shadcn update boundary |
| Haxe facade | `examples/showcase-ui/haxe/showcase/ui/*.hx` | Closed variants, exact props and callbacks, and separate plain versus `asChild` component identities |
| HXX checker | pinned `genes-ts` compiler | Resolves tags and spreads and rejects invalid props or children at the authored Haxe span |
| Independent parity checks | strict TypeScript, Next, and Chromium | Validate the emitted native module graph and real runtime behavior |

The package versions, lockfile integrity, public declaration entry, declaration
digest, required exports, owned source, and evidence are recorded in
[`config/package-integrations.json`](../config/package-integrations.json).
`npm run integrations:check` fails closed if that reviewed boundary drifts.

## Plain and polymorphic identities

The ordinary Button accepts ordinary renderable content:

```haxe
<UiButton variant={ButtonVariant.Outline} type={ButtonType.Button}>
	Continue
</UiButton>
```

The polymorphic identity requires the `asChild` property and exactly one
`genes.react.Element`:

```haxe
<SlottedButton variant={ButtonVariant.Link} asChild>
	<a href="#work">Open work</a>
</SlottedButton>
```

`SlottedButton` is a Haxe-only type view over the same source-owned `Button`
export. It does not add a React wrapper. The emitted TSX is the familiar form:

```tsx
<Button variant="link" asChild>
  <a href="#work">Open work</a>
</Button>
```

Badge follows the same split. Sheet exposes separate
`SlottedSheetTrigger` and `SlottedSheetClose` identities, while a direct Radix
Slot is available when a source-owned component is not needed:

```haxe
<Slot className="contract-slot">
	<a href="#direct-slot">Direct slot</a>
</Slot>

<Sheet>
	<SlottedSheetTrigger asChild>
		<UiButton>Open cart</UiButton>
	</SlottedSheetTrigger>
	<SheetContent side={SheetSide.Right} showCloseButton>
		<SheetTitle>Cart</SheetTitle>
		<SheetDescription>Review the current order.</SheetDescription>
		<SlottedSheetClose asChild>
			<UiButton>Keep shopping</UiButton>
		</SlottedSheetClose>
	</SheetContent>
</Sheet>
```

Command follows the same source-ownership rule but keeps application intent out
of the TSX wrapper. The native component composes cmdk and Radix dialog
behavior; Haxe supplies exact props and a closed command identity:

```haxe
final commandLabel = label(command);
final commandKeywords = [commandLabel].concat(keywords(command));
final select = function(_value:String):Void {
	execute(command, props);
};

<UiCommandItem value={value(command)} keywords={commandKeywords} onSelect={select}>
	{commandLabel}
</UiCommandItem>
```

See [Typed command surfaces with cmdk](cmdk.md) for the shortcut, focus, raw
extern, semantic dispatch, and browser contracts.

All four tags above lower to the existing native `Slot`, `SheetTrigger`,
`SheetContent`, and `SheetClose` exports. There is no generated prop bag,
assertion, cast, or runtime adapter.

## What Haxe rejects

The exact-element view is intentional. These calls fail before TSX is written:

```haxe
<Slot>text is not an element</Slot>
<Slot><button>One</button><button>Two</button></Slot>
<SlottedButton asChild><a href="#one">One</a><span>Two</span></SlottedButton>
<SlottedSheetTrigger asChild />
<Sheet onOpenChange={function(_value:String):Void {}} />
```

The diagnostics distinguish wrong child type, wrong child count, missing
required child, and wrong callback argument. By contrast, plain Button, Badge,
and Sheet content deliberately use the broad renderable-node contract when
their runtime supports text and multiple children.

The semantic split is stronger than one permissive `asChild?: Bool` prop bag:
editor completion presents either the ordinary component or the exact-child
component, and Haxe checks the selected contract at the call site. The
canonical polymorphic spelling is the boolean shorthand `asChild`, which emits
the static TSX attribute. Haxe's ordinary `Bool` does not encode the literal
value `true`, so an explicitly authored `asChild={false}` is type-correct but
opts out of the Radix path at runtime; the facade does not claim otherwise.

Radix's advanced `Slottable` protocol for a component with several surrounding
children is not exposed yet. Supporting it requires its own precise child
model and examples; the current API fails closed instead of pretending that an
arbitrary ReactNode is one slottable element.

## Callback and DOM typing

Callbacks use the narrowest stable event target justified by the runtime:

- a plain Button receives `MouseEvent<HTMLButtonElement>`;
- a Slot-backed control receives `MouseEvent<Element>` because the chosen
  child determines the concrete DOM element;
- Sheet state changes receive `Bool`;
- Sheet Escape and open/close autofocus callbacks receive DOM keyboard/event
  values.

This keeps callback parameters inferred in inline HXX lambdas without
`Dynamic`, `Any`, broad `unknown`, casts, reflection, or TypeScript assertions.
If an application needs a child-specific event target, it should introduce a
named, precise facade for that child rather than narrowing the generic Slot
contract unsafely.

## Interop in both directions

The native shadcn files are consumed from Haxe through exact extern component
identities. Haxe-generated React elements can in turn be supplied as the one
child of a Slot-backed component, because `genes.react.Element` is the shared
compile-time boundary. Generated component modules remain ordinary TSX and can
be imported by handwritten TypeScript or existing Next.js code without a
NextJsHx runtime wrapper.

This is the same ownership model used for Hooks elsewhere in the repository:
native TypeScript remains directly consumable, Haxe-authored code remains
directly consumable from TypeScript, and neither direction weakens Haxe-first
checking.

## Runtime and accessibility evidence

Run the focused declaration and HXX contract with:

```sh
npm run test:integrations
npm run test:showcase-ui
```

Run the production behavior with:

```sh
npm run test:showcases
```

The commerce browser flow opens the cart through the slotted trigger, verifies
that focus enters the dialog, exercises Escape dismissal, verifies focus
returns to the trigger, reopens the Sheet, performs cart updates, and closes it
through a slotted close control. The Todo browser flow exercises the visible
command trigger, Mod+K, result traversal, Escape, focus transfer, URL-backed
intent, and typed route navigation. These complement—rather than replace—the
Haxe prop/callback checks and strict TypeScript/Next build.

## Updating Radix or shadcn

1. Update the exact direct dependency and lockfile.
2. Review Radix's public declaration and shadcn's source diff.
3. Update only the facade fields justified by that public surface.
4. Refresh the reviewed integrity and declaration digest.
5. Run the focused Haxe negatives, strict TypeScript, production Next build,
   and browser focus/keyboard flow.
6. Record newly unsupported behavior explicitly; never use a broad type or
   assertion to make an upgrade compile.

See [Typed npm package integrations](package-integrations.md) for the generic
adoption and provenance policy and [Maintained showcase sites](showcases.md)
for the complete application evidence.
