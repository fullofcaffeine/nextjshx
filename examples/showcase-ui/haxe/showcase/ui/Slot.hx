package showcase.ui;

import genes.react.Element;
import genes.react.MouseEvent;

/**
 * Closed Haxe projection of the Radix Slot props used by the showcases.
 *
 * Radix's declaration accepts ReactNode, but its runtime requires one React
 * element unless the advanced Slottable protocol is used. Requiring Element
 * here moves that locally provable failure to the authored HXX child span.
 */
typedef SlotProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?onClick:MouseEvent<js.html.Element>->Void;
	final children:Element;
}

/**
 * Direct, zero-wrapper import of Radix Slot with a checked single child.
 *
 * Why: the upstream declaration accepts broad React children, while Slot's
 * ordinary runtime path clones exactly one element. Haxe can reject text,
 * omission, and multiple children before that runtime path is reached.
 *
 * What: `@:genes.jsxComponentProps` gives HXX the closed `SlotProps` record.
 * `@:jsRequire` binds the tag to Radix's public named export.
 *
 * How: both annotations are compile-time only. The emitted tag is the normal
 * imported `<Slot>` component; no Haxe wrapper, type escape, or prop conversion is
 * generated. Advanced Radix `Slottable` composition is intentionally absent.
 */
@:jsRequire("@radix-ui/react-slot", "Slot")
@:genes.jsxComponentProps("showcase.ui.Slot.SlotProps")
extern class Slot {}
