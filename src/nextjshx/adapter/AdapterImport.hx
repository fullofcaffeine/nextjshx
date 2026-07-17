package nextjshx.adapter;

/** Describes one exact import required by a generated adapter. */
@:structInit
class AdapterImport {
	public final modulePath:String;
	public final symbol:String;
	public final alias:Null<String>;
	public final typeOnly:Bool;

	public function new(modulePath:String, symbol:String, ?alias:String, typeOnly:Bool = false) {
		this.modulePath = modulePath;
		this.symbol = symbol;
		this.alias = alias;
		this.typeOnly = typeOnly;
	}
}
