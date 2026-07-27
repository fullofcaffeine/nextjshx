package showcase.ui;

typedef TextareaProps = {
	> showcase.ui.Aria.AriaValidationProps,
	@:ts.optional
	final ?id:String;
	@:ts.optional
	final ?name:String;
	@:ts.optional
	final ?value:String;
	@:ts.optional
	final ?defaultValue:String;
	@:ts.optional
	final ?placeholder:String;
	@:ts.optional
	final ?rows:Int;
	@:ts.optional
	final ?maxLength:Int;
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?disabled:Bool;
	@:ts.optional
	final ?required:Bool;
}

/** Source-owned shadcn Textarea exported by the shared showcase package. */
@:jsRequire("@nextjshx/showcase-ui/textarea", "Textarea")
@:genes.jsxComponentProps("showcase.ui.Textarea.TextareaProps")
extern class Textarea {}
