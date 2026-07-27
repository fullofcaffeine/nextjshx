package nextjs.raw.font;

import nextjs.raw.font.FontTypes.NextFont;
import nextjs.raw.font.FontTypes.NextFontWithVariable;
import nextjs.raw.font.GoogleOptions.InterOptions;
import nextjs.raw.font.GoogleOptions.InterOptionsWithVariable;
import nextjs.raw.font.GoogleOptions.RobotoOptions;
import nextjs.raw.font.GoogleOptions.RobotoOptionsWithVariable;

/** Direct named-import bindings for the selected Google font loaders. */
extern class Google {
	@:overload(function(options:InterOptionsWithVariable):NextFontWithVariable {})
	@:jsRequire("next/font/google", "Inter")
	static function inter(?options:InterOptions):NextFont;

	@:overload(function(options:RobotoOptionsWithVariable):NextFontWithVariable {})
	@:jsRequire("next/font/google", "Roboto")
	static function roboto(?options:RobotoOptions):NextFont;
}
