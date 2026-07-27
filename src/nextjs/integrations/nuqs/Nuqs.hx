package nextjs.integrations.nuqs;

#if macro
import haxe.macro.Expr;
#end

/** Intent-oriented, allocation-free nuqs surface for Haxe-authored Hooks. */
class Nuqs {
	/**
	 * Binds one stable, canonical query key to a typed parser.
	 *
	 * The semantic surface requires a compile-time key so malformed delimiters
	 * and render-to-render key changes fail at the Haxe source. The raw binding
	 * remains available when an application deliberately needs a runtime key.
	 */
	public static macro function useQueryState(key:Expr, parser:Expr):Expr {
		return nextjshx.integrations.nuqs.NuqsMacro.useQueryState(key, parser);
	}
}
