package nextjshx.adapter;

/**
 * Literal values accepted by the adapter plan.
 *
 * The tagged model deliberately excludes arbitrary TypeScript expressions so
 * later renderers never need to trust an unvalidated source string.
 */
enum AdapterConfigValue {
	StringValue(value:String);
	IntegerValue(value:Int);
	BooleanValue(value:Bool);
	StringArrayValue(values:Array<String>);
}

/** Records one validated, literal-preserving Next segment configuration value. */
@:structInit
class AdapterConfig {
	public final name:String;
	public final value:AdapterConfigValue;

	public function new(name:String, value:AdapterConfigValue) {
		this.name = name;
		this.value = value;
	}
}
