package nextjshx.adapter;

/** Names the genes-ts module and symbol delegated to by an adapter. */
@:structInit
class AdapterImplementation {
	public final modulePath:String;
	public final symbol:String;

	public function new(modulePath:String, symbol:String) {
		this.modulePath = modulePath;
		this.symbol = symbol;
	}
}
