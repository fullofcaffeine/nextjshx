package mixed_adoption.client;

import nextjs.client.React;

typedef BridgeChannel<Value> = {
	final items:Array<Value>;
	final index:Int;
	final select:Int->Void;
}

@:keep
class HaxeHooks {
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
