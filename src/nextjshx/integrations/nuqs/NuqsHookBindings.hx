package nextjshx.integrations.nuqs;

import nextjs.integrations.nuqs.QueryState.DefaultQueryState;
import nextjs.integrations.nuqs.QueryState.NullableQueryState;
import nextjs.raw.integrations.nuqs.QueryParser;
import nextjs.raw.integrations.nuqs.QueryParser.DefaultQueryParser;

/** Internal direct binding used after the semantic macro validates the key. */
@:noCompletion
extern class NuqsHookBindings {
	@:next.hook
	@:jsRequire("nuqs", "useQueryState")
	@:overload(function<Value>(key:String, parser:DefaultQueryParser<Value>):DefaultQueryState<Value> {})
	static function useQueryState<Value>(key:String, parser:QueryParser<Value>):NullableQueryState<Value>;

	/**
	 * Same native Hook selected only when a semantic macro must preserve a
	 * primitive-backed Haxe domain through TypeScript generic inference.
	 */
	@:next.hook
	@:ts.explicitTypeArguments
	@:jsRequire("nuqs", "useQueryState")
	@:overload(function<Value>(key:String, parser:DefaultQueryParser<Value>):DefaultQueryState<Value> {})
	static function useQueryStateContextual<Value>(key:String, parser:QueryParser<Value>):NullableQueryState<Value>;
}
