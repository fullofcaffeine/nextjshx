package client_components.client;

typedef CounterState = {
	final count:Int;
	final increment:Void->Void;
}

/** Typed fixture seam around React useState; the Haxe component owns its use. */
extern class CounterHook {
	@:next.hook
	@:jsRequire("@nextjshx/client-fixture-hook", "useCounter")
	static function use(initialCount:Int):CounterState;
}
