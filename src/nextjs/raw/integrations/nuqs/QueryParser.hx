package nextjs.raw.integrations.nuqs;

/**
 * Read-only values accepted by nuqs's string-literal parser.
 *
 * Haxe callers can supply an ordinary checked array. The abstract adds no
 * runtime conversion; its TypeScript projection preserves the package's
 * `readonly Literal[]` declaration instead of widening it to a mutable list.
 */
@:ts.type("readonly $0[]")
abstract StringLiteralValues<Value>(Array<Value>) from Array<Value> {}

/**
 * Faithful Haxe view of nuqs's public single-value parser builder.
 *
 * The imported TypeScript projection keeps declaration output tied to the
 * installed package. These members are only a reviewed subset; the raw value
 * is still the original nuqs parser and no Haxe object is created.
 */
@:ts.type("import('nuqs').SingleParserBuilder<$0>")
extern class QueryParser<Value> {
	function parse(value:String):Null<Value>;
	function serialize(value:Value):String;
	function eq(left:Value, right:Value):Bool;
	function withOptions(options:QueryOptions):QueryParser<Value>;
	function withDefault(defaultValue:Value):DefaultQueryParser<Value>;
}

/** Parser builder whose missing query value resolves to a closed default. */
@:ts.type("ReturnType<import('nuqs').SingleParserBuilder<$0>['withDefault']>")
extern class DefaultQueryParser<Value> {
	final defaultValue:Value;
	function parse(value:String):Null<Value>;
	function serialize(value:Value):String;
	function eq(left:Value, right:Value):Bool;
	function withOptions(options:QueryOptions):DefaultQueryParser<Value>;
	function withDefault(defaultValue:Value):DefaultQueryParser<Value>;
}
