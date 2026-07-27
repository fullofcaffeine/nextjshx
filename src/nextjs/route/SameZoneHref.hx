package nextjs.route;

/** A deliberate same-zone target accepted by semantic Next client navigation. */
@:ts.type("string")
abstract SameZoneHref(String) to String {
	/** Reifies only values validated by a route companion or SameZone.href(). */
	@:noCompletion
	private static inline function fromValidatedString(value:String):SameZoneHref {
		// This representation cast is erased; callers cannot access the factory,
		// and the owning macro has already validated the literal/route shape.
		return cast value;
	}
}
