package showcase.ui;

import genes.react.Element;
import genes.react.MouseEvent;
import nextjs.raw.react.ReactNode;

enum abstract ButtonVariant(String) to String {
	final Default = "default";
	final Destructive = "destructive";
	final Outline = "outline";
	final Secondary = "secondary";
	final Ghost = "ghost";
	final Link = "link";
}

enum abstract ButtonSize(String) to String {
	final Default = "default";
	final Small = "sm";
	final Large = "lg";
	final Icon = "icon";
	final IconSmall = "icon-sm";
	final IconLarge = "icon-lg";
}

enum abstract ButtonType(String) to String {
	final Button = "button";
	final Submit = "submit";
	final Reset = "reset";
}

typedef ButtonAppearanceProps = {
	> showcase.ui.Aria.AriaButtonStateProps,
	@:ts.optional
	final ?variant:ButtonVariant;
	@:ts.optional
	final ?size:ButtonSize;
	@:ts.optional
	final ?className:String;
}

typedef ButtonProps = {
	> ButtonAppearanceProps,
	@:ts.optional
	final ?id:String;
	@:ts.optional
	final ?type:ButtonType;
	@:ts.optional
	final ?disabled:Bool;
	@:ts.optional
	final ?onClick:MouseEvent<js.html.ButtonElement>->Void;
	@:ts.optional
	final ?children:ReactNode;
}

/**
 * Props for Radix Slot-backed Button composition.
 *
 * The distinct Haxe component identity makes the one-element asChild contract
 * statically visible while both identities import the same native Button.
 */
typedef SlottedButtonProps = {
	> ButtonAppearanceProps,
	final asChild:Bool;
	@:ts.optional
	final ?onClick:MouseEvent<js.html.Element>->Void;
	final children:Element;
}

/**
 * Source-owned shadcn Button for ordinary button rendering.
 *
 * `@:jsRequire` selects the package's named `Button` export, while
 * `@:genes.jsxComponentProps` makes HXX validate the closed plain-button prop
 * record. Neither annotation creates a runtime adapter.
 */
@:jsRequire("@nextjshx/showcase-ui/button", "Button")
@:genes.jsxComponentProps("showcase.ui.Button.ButtonProps")
extern class UiButton {}

/**
 * Exact-child Haxe view of the same native Button export.
 *
 * Why: one optional `asChild` prop bag would lose Slot's locally provable
 * one-element invariant. This second identity gives editor completion and
 * HXX diagnostics the precise polymorphic contract.
 *
 * What: callers must supply `asChild` and exactly one `Element`. The Bool type
 * proves presence and shape, not that an explicitly supplied value is true;
 * boolean shorthand is the canonical spelling.
 *
 * How: both Haxe identities carry the same `@:jsRequire` binding, so genes-ts
 * emits the ordinary imported `<Button asChild>` tag without a wrapper.
 */
@:jsRequire("@nextjshx/showcase-ui/button", "Button")
@:genes.jsxComponentProps("showcase.ui.Button.SlottedButtonProps")
extern class SlottedButton {}
