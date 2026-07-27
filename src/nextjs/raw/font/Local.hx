package nextjs.raw.font;

import nextjs.raw.font.FontTypes.NextFont;
import nextjs.raw.font.FontTypes.NextFontWithVariable;
import nextjs.raw.font.LocalFontOptions.LocalFontOptionsWithVariable;

/** Direct default-import binding for `next/font/local`. */
extern class Local {
	@:overload(function(options:LocalFontOptionsWithVariable):NextFontWithVariable {})
	@:jsRequire("next/font/local", "default")
	static function load(options:LocalFontOptions):NextFont;
}
