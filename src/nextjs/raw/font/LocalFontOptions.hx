package nextjs.raw.font;

import haxe.extern.EitherType;
import nextjs.raw.font.FontTypes.CssVariable;
import nextjs.raw.font.FontTypes.FontDisplay;

/** One file in a multi-source local font family. */
typedef LocalFontSource = {
	final path:String;
	@:optional var weight:String;
	@:optional var style:String;
}

typedef LocalFontSources = EitherType<String, Array<LocalFontSource>>;

/** Browser font used when Next derives local fallback metrics. */
@:ts.type("'Arial' | 'Times New Roman'")
enum abstract LocalFontFallback(String) to String {
	final Arial = "Arial";
	final TimesNewRoman = "Times New Roman";
}

/** Explicitly disable local fallback metric adjustment. */
@:ts.type("false")
enum abstract LocalFontFallbackDisabled(Bool) to Bool {
	final Disabled = false;
}

typedef LocalFontDeclaration = {
	final prop:String;
	final value:String;
}

typedef LocalFontOptionsFields = {
	final src:LocalFontSources;
	@:optional var display:FontDisplay;
	@:optional var weight:String;
	@:optional var style:String;
	@:optional var adjustFontFallback:EitherType<LocalFontFallback, LocalFontFallbackDisabled>;
	@:optional var fallback:Array<String>;
	@:optional var preload:Bool;
	@:optional var declarations:Array<LocalFontDeclaration>;
}

/** Local font options that return the common non-variable result. */
@:ts.type("Omit<Parameters<typeof import('next/font/local').default>[0], 'variable'>")
abstract LocalFontOptions(LocalFontOptionsFields) from LocalFontOptionsFields {}

typedef LocalFontOptionsWithVariableFields = {
	> LocalFontOptionsFields,
	final variable:CssVariable;
}

/** Local font options that guarantee the variable field on the result. */
@:ts.type("Omit<Parameters<typeof import('next/font/local').default>[0], 'variable'> & { variable: `--$${string}` }")
abstract LocalFontOptionsWithVariable(LocalFontOptionsWithVariableFields) from LocalFontOptionsWithVariableFields {}
