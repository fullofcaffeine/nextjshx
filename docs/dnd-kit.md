# Accessible sortable interfaces with dnd-kit

NextJsHx integrates `@dnd-kit/react` 0.5.0 and `@dnd-kit/helpers` 0.5.0 as
the headless drag-and-drop layer. The packages remain the runtime. The Haxe
surface adds closed event projections, string domain IDs, typed element refs,
and an exhaustive reorder result without copying dnd-kit or leaking its broad
internal `Data = Record<string, any>` type.

The integration was added for the flagship Todo application. While developing
that sortable list, two concrete boundary problems appeared:

- dnd-kit's host identity is `string | number`, while application entities use
  validated string IDs; treating every event as a string would be unchecked;
- a drag end can be cancelled, lack a source or target, refer to a stale ID,
  project an invalid destination, or land at the same position; silently
  treating all of those as a successful reorder hides real state transitions.

The semantic API closes both gaps while preserving dnd-kit's normal provider,
Hook, sensors, plugins, DOM behavior, imports, and immutable `arrayMove` helper.

## Current 0.5 API, not the legacy API

The reviewed `@dnd-kit/react/sortable` declaration returns:

- `ref`, `sourceRef`, and `targetRef` for the sortable element;
- `handleRef` for an optional dedicated activator; and
- `isDragging`, `isDropping`, `isDragSource`, and `isDropTarget` state.

It does **not** return the legacy `attributes` and `listeners` objects shown in
older dnd-kit examples. In 0.5, the provider's default preset installs pointer
and keyboard sensors, the accessibility plugin, sortable keyboard movement,
and optimistic sorting. Once the returned refs are attached, those plugins own
the event listeners and apply the appropriate focus and ARIA attributes.

NextJsHx binds that actual public API. It does not recreate legacy props or
replace accessibility behavior with a framework-specific implementation.

## Semantic authoring

Call the semantic Hook once at the top of the item Client Component and attach
the refs to real browser elements:

```haxe
import genes.react.Element;
import nextjs.integrations.dndkit.DndKit;

typedef SortableRowProps = {
	final id:String;
	final index:Int;
	final title:String;
}

@:next.clientComponent
class SortableRow {
	public static function render(props:SortableRowProps):Element {
		final sortable = DndKit.useSortable(props.id, props.index);
		return <li ref={sortable.ref} data-dragging={sortable.isDragging}>
			<button
				type="button"
				ref={sortable.handleRef}
				aria-label={"Reorder " + props.title}
			>
				Move
			</button>
			<span>{props.title}</span>
		</li>;
	}
}
```

HXX checks the Hook arguments and each ref target before generated output
exists. `id` must be a `String`, `index` must be an `Int`, and a ref for an
incompatible browser element is rejected at its authored attribute span.

The ordinary generated call remains recognizable:

```tsx
const sortable = useSortable({ id: props.id, index: props.index });

return <li ref={sortable.ref} data-dragging={sortable.isDragging}>
  <button
    type="button"
    ref={sortable.handleRef}
    aria-label={"Reorder " + props.title}
  >
    Move
  </button>
  <span>{props.title}</span>
</li>;
```

There is no Hook wrapper call, assertion, hidden compiler-generated prop
carrier, or manually copied listener object in the application output. An
authored, precisely typed props spread remains available when it makes the HXX
and emitted TSX clearer.

### Keep sortable rows keyed by domain identity

The parent list must give every sortable component a stable React key:

```haxe
for (index in 0...items.length) {
	final item = items[index];
	rows.push(<SortableRow key={item.id} id={item.id} index={index} title={item.title} />);
}
```

dnd-kit's optimistic plugin moves DOM nodes before the application commits its
new array. Without `key={item.id}`, React may reconcile component instances by
position and restore the old visual order even though application state and the
live announcement report a successful move. The Todo production browser found
that exact failure; its emitted-output gate now requires the authored key.

## Provider and exhaustive reorder handling

Use the package's real provider and make every drag-end outcome visible:

```haxe
import nextjs.integrations.dndkit.DndKit;
import nextjs.raw.integrations.dndkit.DragDropProvider;

final onDragEnd = event -> switch DndKit.reorder(items, event, item -> item.id) {
	case Moved(next, from, to):
		itemsState.set(next);
		announce('Moved item ${from + 1} to ${to + 1}.');
	case Unchanged(_, index):
		announce('Item ${index + 1} stayed in place.');
	case Cancelled:
		announce("Move cancelled.");
	case MissingSource | MissingTarget:
		announce("Move ended without a complete target.");
	case UnsupportedSourceId | UnsupportedTargetId:
		announce("Move used an unsupported numeric host ID.");
	case InvalidProjectedIndex(index):
		announce('Move used invalid projected position $index.');
	case SourceNotFound(id) | TargetNotFound(id):
		announce('Move referred to stale item $id.');
};

return <DragDropProvider onDragEnd={onDragEnd}>
	<ol>{rows}</ol>
</DragDropProvider>;
```

During optimistic pointer and keyboard sorting, dnd-kit projects the destination
through the source entity's optional `index`. The semantic layer validates that
index before using it and otherwise falls back to the target entity's current
position. `Moved` contains the new array returned by the package's own
`arrayMove` helper. `Unchanged` retains the original array. The remaining
variants do not pretend that a move occurred, so an application can log,
announce, retry, or ignore each condition deliberately.

The one external union boundary validates dnd-kit's `string | number` value at
runtime before exposing a semantic string ID. Numeric IDs remain available on
the faithful raw layer for TypeScript parity, but they cannot accidentally
enter the application-facing string-ID path.

## Positive and negative controls

This is accepted and emits the direct package Hook:

```haxe
final sortable = DndKit.useSortable(todo.id, index);
return <li ref={sortable.ref}>...</li>;
```

These fail in Haxe before TSX is written:

```haxe
DndKit.useSortable(42, index);       // ID must be String
DndKit.useSortable(todo.id, "one"); // index must be Int

<li ref="row" />                    // ref must be a React ref
<li ref={inputOnlyRef} />            // wrong browser element target
```

Calling `useSortable` conditionally, in a loop, in an event handler, or outside
a reviewed Client Component/custom Hook also retains the exact React Hook
placement diagnostics.

### Official lint over the generated Haxe Hook

The focused lane runs `react-hooks/rules-of-hooks` over the actual generated
`Positive.tsx`, not a hand-written stand-in. NextJsHx marks the reviewed Haxe
Hook body for framework-neutral module-function lowering in genes-ts, so the
analyzer sees an ordinary function such as `function useSemantic(...)` while
Haxe callers retain the same typed `Positive.useSemantic` field and runtime
identity. A conditional native TSX call remains the negative control proving
the official rule is active.

Haxe's typed Hook-identity and placement pass still runs first and owns Haxe
source diagnostics. Official lint, strict TypeScript, the Next production
build, and hydrated browser behavior remain independent downstream evidence;
none replaces another or requires a lint suppression.

## Raw compatibility surface

Use `nextjs.raw.integrations.dndkit` when porting a native React module that
deliberately uses numeric IDs, groups, disabled sortables, or the host-shaped
event contract. The raw surface exposes only reviewed public fields; unsupported
package options remain omitted until they have precise Haxe types and tests.

Native TypeScript components can continue to import dnd-kit directly and can be
consumed from Haxe through precise extern props. Haxe-authored sortable Client
Components are published through the same directive-first typed adapters as
other NextJsHx components, so an existing TypeScript Next.js application can
consume them without learning a separate runtime.

## Evidence

The dnd-kit fixture proves exact package pins and declarations, positive Hook
and ref inference, wrong ID/index/callback/ref failures in Haxe, canonical
imports and JSX, strict TypeScript, and source escape checks. The Todo example
adds stable-key output inspection, production Next compilation, and pointer,
mobile, and keyboard browser reordering against the provider's default
accessible behavior.

Run the focused lanes with:

```sh
npm run test:dnd-kit
npm run test:example:todoapp
```

`npm run test:integrations` independently fails on version, integrity, public
export, declaration-entry, declaration-digest, or reviewed-source drift.
