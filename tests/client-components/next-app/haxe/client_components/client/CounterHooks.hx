package client_components.client;

import client_components.client.CounterHook.CounterState;

/** Haxe-authored custom Hook composing one reviewed native Hook binding. */
class CounterHooks {
	@:next.hook
	public static function useCounterState(initialCount:Int):CounterState {
		return CounterHook.use(initialCount);
	}

	/** Ordinary helpers avoid React's reserved use-prefixed emitted spelling. */
	public static function friendlyLabel(label:String):String {
		return label.toUpperCase();
	}
}
