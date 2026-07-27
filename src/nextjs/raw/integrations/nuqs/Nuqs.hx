package nextjs.raw.integrations.nuqs;

import nextjs.raw.integrations.nuqs.QueryStateResult.DefaultQueryStateResult;
import nextjs.raw.integrations.nuqs.QueryStateResult.NullableQueryStateResult;
import nextjs.raw.integrations.nuqs.QueryOptions.QueryRateLimit;
import nextjs.raw.integrations.nuqs.QueryParser.DefaultQueryParser;
import nextjs.raw.integrations.nuqs.QueryParser.StringLiteralValues;

/** Faithful reviewed bindings to nuqs's public client entrypoint. */
extern class Nuqs {
	@:jsRequire("nuqs", "parseAsString")
	static final parseAsString:QueryParser<String>;

	@:jsRequire("nuqs", "parseAsInteger")
	static final parseAsInteger:QueryParser<Int>;

	@:jsRequire("nuqs", "parseAsFloat")
	static final parseAsFloat:QueryParser<Float>;

	@:jsRequire("nuqs", "parseAsBoolean")
	static final parseAsBoolean:QueryParser<Bool>;

	/** Closed parser whose invalid host strings resolve to `null`. */
	@:ts.explicitTypeArguments
	@:jsRequire("nuqs", "parseAsStringLiteral")
	static function parseAsStringLiteral<Value>(validValues:StringLiteralValues<Value>):QueryParser<Value>;

	@:jsRequire("nuqs", "debounce")
	static function debounce(timeMs:Float):QueryRateLimit;

	@:jsRequire("nuqs", "throttle")
	static function throttle(timeMs:Float):QueryRateLimit;

	/**
	 * Direct React Hook binding. Callable values share nuqs's raw updater
	 * ambiguity; prefer the semantic integration for intent-named writes.
	 */
	@:next.hook
	@:jsRequire("nuqs", "useQueryState")
	@:overload(function<Value>(key:String, parser:DefaultQueryParser<Value>):DefaultQueryStateResult<Value> {})
	static function useQueryState<Value>(key:String, parser:QueryParser<Value>):NullableQueryStateResult<Value>;
}
