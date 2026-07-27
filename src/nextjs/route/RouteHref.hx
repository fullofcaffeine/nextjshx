package nextjs.route;

/**
 * A route URL whose TypeScript projection retains its concrete route shape.
 *
 * Generated route declarations expose Haxe-native `href()` companions that
 * return this type. The `Pattern` marker is erased by Haxe but remains the
 * input to Next's generated `Route<T>` contract in TypeScript output.
 */
@:ts.type("import('next').Route<$0>")
abstract RouteHref<Pattern>(String) to String {
	/** Allows semantic NextLink while retaining the concrete Route<T> marker. */
	@:to
	public inline function toSameZoneHref():SameZoneHref {
		return @:privateAccess SameZoneHref.fromValidatedString(this);
	}

	/**
	 * Reifies a parser-validated value without adding a runtime wrapper.
	 *
	 * This stays private so ordinary Strings cannot bypass a route companion.
	 * The underlying-representation cast is erased by both Genes emitters, and
	 * Next's generated Route<T> contract checks the resulting expression again.
	 */
	@:noCompletion
	private static inline function fromValidatedString<Pattern>(value:String):RouteHref<Pattern> {
		return cast value;
	}

	/** Retains the exact pathname pattern while query construction evaluates it once. */
	@:noCompletion
	private static inline function toPatternString<Pattern>(value:RouteHref<Pattern>):RoutePath<Pattern> {
		return cast value;
	}
}

/** Internal erased pathname view used to preserve TypeScript literal context. */
@:noCompletion
@:ts.type("Extract<$0, string>")
abstract RoutePath<Pattern>(String) to String {}
