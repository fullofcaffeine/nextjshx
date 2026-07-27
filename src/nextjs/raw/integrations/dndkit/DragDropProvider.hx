package nextjs.raw.integrations.dndkit;

import nextjs.raw.react.ReactNode;

/** Reviewed props for dnd-kit's root React provider. */
typedef DragDropProviderProps = {
	@:ts.optional
	final ?children:ReactNode;
	@:ts.optional
	final ?onDragEnd:DragEndEvent->Void;
}

/**
 * Direct component import from dnd-kit's public React entrypoint.
 *
 * The package's default preset owns pointer and keyboard sensors plus its
 * accessibility plugin. Attaching the refs returned by `useSortable` is what
 * activates the corresponding ARIA and input behavior; there is no legacy
 * attributes/listeners object in the reviewed 0.5 API.
 */
@:jsRequire("@dnd-kit/react", "DragDropProvider")
@:genes.jsxComponentProps("nextjs.raw.integrations.dndkit.DragDropProvider.DragDropProviderProps")
extern class DragDropProvider {}
