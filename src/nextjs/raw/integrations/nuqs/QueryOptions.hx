package nextjs.raw.integrations.nuqs;

/** How one query update changes the browser history stack. */
@:ts.type("'replace' | 'push'")
enum abstract QueryHistory(String) to String {
	final Replace = "replace";
	final Push = "push";
}

/** Rate-limit policy created by nuqs's public `debounce` and `throttle` helpers. */
@:ts.type("import('nuqs').LimitUrlUpdates")
extern class QueryRateLimit {}

/**
 * Reviewed client options shared by parsers, setters, and the App Router adapter.
 *
 * The TypeScript projection points to nuqs's public declaration so upstream
 * assignability remains independently checked. The Haxe view deliberately
 * exposes the stable, data-only options used by the semantic integration.
 */
typedef QueryOptionsFields = {
	@:optional var history:QueryHistory;
	@:optional var scroll:Bool;
	@:optional var shallow:Bool;
	@:optional var limitUrlUpdates:QueryRateLimit;
	@:optional var clearOnDefault:Bool;
}

@:ts.type("import('nuqs').Options")
abstract QueryOptions(QueryOptionsFields) from QueryOptionsFields {}
