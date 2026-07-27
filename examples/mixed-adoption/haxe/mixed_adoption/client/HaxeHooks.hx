package mixed_adoption.client;

import nextjs.client.React;

typedef BridgeChannel<Value> = {
	final items:Array<Value>;
	final index:Int;
	final select:Int->Void;
}

@:keep
class HaxeHooks {
	/**
	 * `@:next.hook` lets NextJsHx apply React's Hook-placement rules to this
	 * Haxe body. `@:next.exportHook` additionally publishes a directive-first
	 * `useBridgeChannel` TypeScript export as a typed const alias: native TSX
	 * can consume it without a wrapper call or lost generic inference.
	 */
	@:next.hook
	@:next.exportHook
	public static function useBridgeChannel<Value>(items:Array<Value>):BridgeChannel<Value> {
		final index = React.useState(0);
		return {
			items: items,
			index: index.value,
			select: next -> index.set(next)
		};
	}
}
