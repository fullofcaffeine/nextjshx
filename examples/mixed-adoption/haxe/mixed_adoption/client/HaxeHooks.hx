package mixed_adoption.client;

import genes.react.React.useState;

typedef BridgeChannel<Value> = {
	final items:Array<Value>;
	final index:Int;
	final select:Int->Void;
}

/**
 * Temporary DCE root for the Haxe Hook published to native TSX.
 *
 * The Hook has no class identity. The current export/analyzer bridge requires
 * a retained public static field, then publishes an analyzer-visible native
 * module function. Once NextJsHx consumes the framework-neutral
 * `genes.react` module-Hook/export surface, this shell class can be removed.
 */
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
		final index = useState(0);
		return {
			items: items,
			index: index.value,
			select: next -> index.set(next)
		};
	}
}
