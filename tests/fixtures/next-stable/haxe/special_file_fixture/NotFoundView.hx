package special_file_fixture;

import genes.react.Element;

/** Haxe-owned segment fallback reached through Next's native notFound API. */
@:next.notFound("special/not-found")
class NotFoundView {
	public static function render():Element {
		return <main id={"haxe-not-found"}>HAXE-NOT-FOUND</main>;
	}
}
