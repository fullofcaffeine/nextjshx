package nextjs.raw.font;

/** CSS font-display behavior accepted by both Google and local font loaders. */
@:ts.type("'auto' | 'block' | 'swap' | 'fallback' | 'optional'")
enum abstract FontDisplay(String) to String {
	final Auto = "auto";
	final Block = "block";
	final Swap = "swap";
	final Fallback = "fallback";
	final Optional = "optional";
}

/** A custom property name accepted by Next's generated font CSS. */
@:ts.type("`--$${string}`")
abstract CssVariable(String) from String to String {}

/** CSS style metadata returned by every Next font loader. */
typedef NextFontStyle = {
	final fontFamily:String;
	@:optional var fontWeight:Float;
	@:optional var fontStyle:String;
}

/** Common result returned when no CSS variable is requested. */
typedef NextFont = {
	final className:String;
	final style:NextFontStyle;
}

/** Result returned when the options include a CSS variable name. */
typedef NextFontWithVariable = {
	> NextFont,
	final variable:String;
}
