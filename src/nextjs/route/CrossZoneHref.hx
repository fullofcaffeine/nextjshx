package nextjs.route;

/** A deliberate hard-navigation target for an anchor crossing Next zones. */
@:ts.type("string")
abstract CrossZoneHref(String) to String {
	@:noCompletion
	private static inline function fromValidatedString(value:String):CrossZoneHref {
		// This representation cast is erased; CrossZone.href() is the only public
		// constructor and validates the literal before generated output exists.
		return cast value;
	}
}
