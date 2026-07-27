package nextjs.route;

/**
 * A parser-validated pathname plus a query produced by one closed Haxe schema.
 *
 * The result also admits the bare pathname because optional/repeated-only
 * schemas can encode zero pairs. Ordinary Strings cannot construct this type.
 */
@:ts.type("import('next').Route<$0 | `${Extract<$0, string>}?${string}`>")
abstract RouteHrefWithQuery<Pattern>(String) to String {
	/** Query-bearing generated routes remain deliberate same-zone targets. */
	@:to
	public inline function toSameZoneHref():SameZoneHref {
		return @:privateAccess SameZoneHref.fromValidatedString(this);
	}

	@:noCompletion
	private static inline function fromValidatedString<Pattern>(value:String):RouteHrefWithQuery<Pattern> {
		return cast value;
	}
}
