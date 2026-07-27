package showcase.ui;

enum abstract SeparatorOrientation(String) to String {
	final Horizontal = "horizontal";
	final Vertical = "vertical";
}

typedef SeparatorProps = {
	@:ts.optional
	final ?orientation:SeparatorOrientation;
	@:ts.optional
	final ?decorative:Bool;
	@:ts.optional
	final ?className:String;
}

/** Source-owned shadcn/Radix Separator exported by the shared package. */
@:jsRequire("@nextjshx/showcase-ui/separator", "Separator")
@:genes.jsxComponentProps("showcase.ui.Separator.SeparatorProps")
extern class Separator {}
