package showcase.ui;

import genes.react.Element;
import genes.react.MouseEvent;
import nextjs.raw.react.ReactNode;

enum abstract SheetSide(String) to String {
	final Top = "top";
	final Right = "right";
	final Bottom = "bottom";
	final Left = "left";
}

typedef SheetProps = {
	@:ts.optional
	final ?open:Bool;
	@:ts.optional
	final ?defaultOpen:Bool;
	@:ts.optional
	final ?modal:Bool;
	@:ts.optional
	final ?onOpenChange:Bool->Void;
	@:ts.optional
	final ?children:ReactNode;
}

typedef SheetTriggerProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?onClick:MouseEvent<js.html.ButtonElement>->Void;
	@:ts.optional
	final ?children:ReactNode;
}

/** Single-element Radix asChild contract shared by Sheet Trigger and Close. */
typedef SlottedSheetControlProps = {
	final asChild:Bool;
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?onClick:MouseEvent<js.html.Element>->Void;
	final children:Element;
}

typedef SheetContentProps = {
	@:ts.optional
	final ?side:SheetSide;
	@:ts.optional
	final ?showCloseButton:Bool;
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?onEscapeKeyDown:js.html.KeyboardEvent->Void;
	@:ts.optional
	final ?onOpenAutoFocus:js.html.Event->Void;
	@:ts.optional
	final ?onCloseAutoFocus:js.html.Event->Void;
	@:ts.optional
	final ?children:ReactNode;
}

typedef SheetPartProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?children:ReactNode;
}

/**
 * Source-owned shadcn Sheet root backed by Radix Dialog state.
 *
 * The metadata binds directly to the native named export and supplies HXX's
 * closed props contract; the Sheet implementation remains the runtime.
 */
@:jsRequire("@nextjshx/showcase-ui/sheet", "Sheet")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetProps")
extern class Sheet {}

/** Ordinary Sheet trigger, including native button content. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetTrigger")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetTriggerProps")
extern class SheetTrigger {}

/** Ordinary Sheet close control, including native button content. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetClose")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetTriggerProps")
extern class SheetClose {}

/**
 * Exact-child `asChild` view of the native SheetTrigger export.
 *
 * HXX requires the flag and one `Element`; genes-ts coalesces this Haxe-only
 * identity back to `<SheetTrigger asChild>` without a React wrapper.
 */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetTrigger")
@:genes.jsxComponentProps("showcase.ui.Sheet.SlottedSheetControlProps")
extern class SlottedSheetTrigger {}

/** Exact-child view that emits the native `<SheetClose asChild>` control. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetClose")
@:genes.jsxComponentProps("showcase.ui.Sheet.SlottedSheetControlProps")
extern class SlottedSheetClose {}

/** Portaled panel with typed side, focus, and Escape-key callbacks. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetContent")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetContentProps")
extern class SheetContent {}

/** Layout-only Sheet header owned by the source package. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetHeader")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetPartProps")
extern class SheetHeader {}

/** Layout-only Sheet footer owned by the source package. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetFooter")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetPartProps")
extern class SheetFooter {}

/** Accessible Dialog title rendered by the source-owned Sheet. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetTitle")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetPartProps")
extern class SheetTitle {}

/** Accessible Dialog description rendered by the source-owned Sheet. */
@:jsRequire("@nextjshx/showcase-ui/sheet", "SheetDescription")
@:genes.jsxComponentProps("showcase.ui.Sheet.SheetPartProps")
extern class SheetDescription {}
