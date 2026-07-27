package nextjs.route;

/**
 * A parser-validated Route Handler URL with its concrete Next route shape.
 *
 * It converts to String for fetch/request APIs but deliberately does not
 * convert to SameZoneHref, so an API endpoint cannot be passed to semantic
 * NextLink as though it were a page.
 */
@:ts.type("import('next').Route<$0>")
abstract RouteHandlerHref<Pattern>(String) to String {
	@:noCompletion
	private static inline function fromValidatedString<Pattern>(value:String):RouteHandlerHref<Pattern> {
		// The macro validates and encodes every route field first; this erased
		// representation cast adds no runtime wrapper or unchecked public seam.
		return cast value;
	}
}
