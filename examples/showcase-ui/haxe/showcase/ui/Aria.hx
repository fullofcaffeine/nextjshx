package showcase.ui;

enum abstract AriaHasPopup(String) to String {
	final Dialog = "dialog";
	final Grid = "grid";
	final ListBox = "listbox";
	final Menu = "menu";
	final Tree = "tree";
}

/** Typed Haxe-facing aliases mapped by shared UI wrappers to DOM ARIA names. */
typedef AriaLabelProps = {
	@:ts.optional
	final ?ariaLabel:String;
}

typedef AriaButtonStateProps = {
	> AriaLabelProps,
	@:ts.optional
	final ?ariaPressed:Bool;
	@:ts.optional
	final ?ariaHasPopup:AriaHasPopup;
}

typedef AriaValidationProps = {
	@:ts.optional
	final ?ariaInvalid:Bool;
}
