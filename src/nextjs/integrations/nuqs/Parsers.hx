package nextjs.integrations.nuqs;

#if macro
import haxe.macro.Expr;
#end

/** Inference-friendly access to nuqs's built-in scalar parsers. */
class Parsers {
	/** String query parser, optionally made non-null with one default value. */
	public static macro function string(arguments:Array<Expr>):Expr {
		return nextjshx.integrations.nuqs.NuqsMacro.parser("parseAsString", arguments);
	}

	/** Integer query parser, optionally made non-null with one default value. */
	public static macro function integer(arguments:Array<Expr>):Expr {
		return nextjshx.integrations.nuqs.NuqsMacro.parser("parseAsInteger", arguments);
	}

	/** Floating-point query parser, optionally made non-null with one default value. */
	public static macro function float(arguments:Array<Expr>):Expr {
		return nextjshx.integrations.nuqs.NuqsMacro.parser("parseAsFloat", arguments);
	}

	/** Boolean query parser, optionally made non-null with one default value. */
	public static macro function boolean(arguments:Array<Expr>):Expr {
		return nextjshx.integrations.nuqs.NuqsMacro.parser("parseAsBoolean", arguments);
	}

	/**
	 * Closed string-domain parser with one explicit default.
	 *
	 * Author the domain as a String-backed Haxe enum abstract and pass its values
	 * in an inline, non-empty array. The macro proves that the default and every
	 * value share that exact domain before genes-ts emits nuqs's canonical
	 * `parseAsStringLiteral<"value" | ...>([...]).withDefault(...)` expression.
	 * The compiler-only type witness is an implementation detail: no helper,
	 * assertion, or duplicated evaluation reaches generated TypeScript or
	 * JavaScript. nuqs then validates untrusted URL text at runtime, so an invalid
	 * host value resolves to the closed default rather than entering the model.
	 */
	public static macro function stringLiteral(validValues:Expr, defaultValue:Expr):Expr {
		return nextjshx.integrations.nuqs.NuqsMacro.stringLiteralParser(validValues, defaultValue);
	}
}
