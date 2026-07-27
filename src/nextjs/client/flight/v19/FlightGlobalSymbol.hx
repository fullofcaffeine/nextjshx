package nextjs.client.flight.v19;

/**
 * Exact binding for JavaScript's global symbol registry factory.
 *
 * A dotted native self-call is used so genes-ts emits canonical
 * `Symbol.for(key)` rather than a helper or a computed property call.
 */
@:native("Symbol.for")
private extern class GlobalSymbolFactory {
	@:selfCall
	static function create(key:String):js.lib.Symbol;
}

@:native("String")
private extern class GlobalSymbolLabel {
	@:selfCall
	static function create(value:js.lib.Symbol):String;
}

/**
 * React 19 Flight symbol proven to come from the global `Symbol.for` registry.
 *
 * There is intentionally no conversion from `js.lib.Symbol`: a locally
 * created symbol has the same JavaScript type but is not serializable by
 * React Flight.
 */
abstract FlightGlobalSymbol(js.lib.Symbol) {
	private inline function new(value:js.lib.Symbol) {
		this = value;
	}

	public static inline function forKey(key:String):FlightGlobalSymbol {
		return new FlightGlobalSymbol(GlobalSymbolFactory.create(key));
	}

	/** Returns JavaScript's stable display label, such as `Symbol(app.marker)`. */
	public inline function label():String {
		return GlobalSymbolLabel.create(this);
	}
}
