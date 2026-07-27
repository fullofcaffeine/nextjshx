package showcase.ui;

import genes.react.ChangeEvent;

enum abstract InputType(String) to String {
	final Text = "text";
	final Email = "email";
	final Search = "search";
	final Number = "number";
}

typedef InputProps = {
	> showcase.ui.Aria.AriaValidationProps,
	@:ts.optional
	final ?id:String;
	@:ts.optional
	final ?type:InputType;
	@:ts.optional
	final ?name:String;
	@:ts.optional
	final ?value:String;
	@:ts.optional
	final ?defaultValue:String;
	@:ts.optional
	final ?placeholder:String;
	@:ts.optional
	final ?autoComplete:String;
	@:ts.optional
	final ?maxLength:Int;
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?disabled:Bool;
	@:ts.optional
	final ?required:Bool;
	@:ts.optional
	final ?onChange:ChangeEvent<js.html.InputElement>->Void;
}

/** Source-owned shadcn Input exported by the shared showcase package. */
@:jsRequire("@nextjshx/showcase-ui/input", "Input")
@:genes.jsxComponentProps("showcase.ui.Input.InputProps")
extern class UiInput {}
