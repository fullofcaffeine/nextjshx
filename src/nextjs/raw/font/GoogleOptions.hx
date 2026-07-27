package nextjs.raw.font;

import haxe.extern.EitherType;
import nextjs.raw.font.FontTypes.CssVariable;
import nextjs.raw.font.FontTypes.FontDisplay;

/** Static weights shared by the selected Inter and Roboto families. */
@:ts.type("'100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'")
enum abstract GoogleStaticWeight(String) to String {
	final W100 = "100";
	final W200 = "200";
	final W300 = "300";
	final W400 = "400";
	final W500 = "500";
	final W600 = "600";
	final W700 = "700";
	final W800 = "800";
	final W900 = "900";
}

/** A single weight may additionally request the variable font. */
@:ts.type("'100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'variable'")
enum abstract GoogleWeight(String) to String {
	final W100 = "100";
	final W200 = "200";
	final W300 = "300";
	final W400 = "400";
	final W500 = "500";
	final W600 = "600";
	final W700 = "700";
	final W800 = "800";
	final W900 = "900";
	final Variable = "variable";
}

typedef GoogleWeightSelection = EitherType<GoogleWeight, Array<GoogleStaticWeight>>;

@:ts.type("'normal' | 'italic'")
enum abstract GoogleFontStyle(String) to String {
	final Normal = "normal";
	final Italic = "italic";
}

typedef GoogleStyleSelection = EitherType<GoogleFontStyle, Array<GoogleFontStyle>>;

@:ts.type("'cyrillic' | 'cyrillic-ext' | 'greek' | 'greek-ext' | 'latin' | 'latin-ext' | 'vietnamese'")
enum abstract InterSubset(String) to String {
	final Cyrillic = "cyrillic";
	final CyrillicExt = "cyrillic-ext";
	final Greek = "greek";
	final GreekExt = "greek-ext";
	final Latin = "latin";
	final LatinExt = "latin-ext";
	final Vietnamese = "vietnamese";
}

@:ts.type("'cyrillic' | 'cyrillic-ext' | 'greek' | 'greek-ext' | 'latin' | 'latin-ext' | 'math' | 'symbols' | 'vietnamese'")
enum abstract RobotoSubset(String) to String {
	final Cyrillic = "cyrillic";
	final CyrillicExt = "cyrillic-ext";
	final Greek = "greek";
	final GreekExt = "greek-ext";
	final Latin = "latin";
	final LatinExt = "latin-ext";
	final Math = "math";
	final Symbols = "symbols";
	final Vietnamese = "vietnamese";
}

@:ts.type("'opsz'")
enum abstract InterAxis(String) to String {
	final OpticalSize = "opsz";
}

@:ts.type("'wdth'")
enum abstract RobotoAxis(String) to String {
	final Width = "wdth";
}

private typedef GoogleOptionsBase = {
	@:optional var weight:GoogleWeightSelection;
	@:optional var style:GoogleStyleSelection;
	@:optional var display:FontDisplay;
	@:optional var preload:Bool;
	@:optional var fallback:Array<String>;
	@:optional var adjustFontFallback:Bool;
}

typedef InterOptionsFields = {
	> GoogleOptionsBase,
	@:optional var subsets:Array<InterSubset>;
	@:optional var axes:Array<InterAxis>;
}

/** Haxe-visible Inter options, exact-projected to Next's public declaration. */
@:ts.type("NonNullable<Parameters<typeof import('next/font/google').Inter>[0]>")
abstract InterOptions(InterOptionsFields) from InterOptionsFields {}

typedef InterOptionsWithVariableFields = {
	> InterOptionsFields,
	final variable:CssVariable;
}

/** Inter options that guarantee the variable field on the returned value. */
@:ts.type("NonNullable<Parameters<typeof import('next/font/google').Inter>[0]> & { variable: `--$${string}` }")
abstract InterOptionsWithVariable(InterOptionsWithVariableFields) from InterOptionsWithVariableFields {}

typedef RobotoOptionsFields = {
	> GoogleOptionsBase,
	@:optional var subsets:Array<RobotoSubset>;
	@:optional var axes:Array<RobotoAxis>;
}

/** Haxe-visible Roboto options, exact-projected to Next's public declaration. */
@:ts.type("NonNullable<Parameters<typeof import('next/font/google').Roboto>[0]>")
abstract RobotoOptions(RobotoOptionsFields) from RobotoOptionsFields {}

typedef RobotoOptionsWithVariableFields = {
	> RobotoOptionsFields,
	final variable:CssVariable;
}

/** Roboto options that guarantee the variable field on the returned value. */
@:ts.type("NonNullable<Parameters<typeof import('next/font/google').Roboto>[0]> & { variable: `--$${string}` }")
abstract RobotoOptionsWithVariable(RobotoOptionsWithVariableFields) from RobotoOptionsWithVariableFields {}
