package route_href_fixture.page;

/** Sentinel server implementation that route refs must never import or retain. */
class TodoPageImplementation {
	public static function render():String {
		return "server-only-page-implementation";
	}
}
