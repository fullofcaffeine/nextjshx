package client_components.client;

import nextjs.client.React;

typedef Selection<Value> = {
	final items:Array<Value>;
	final index:Int;
	final select:Int->Void;
}

/** Generic Haxe Hook whose generated `typeof` alias must retain inference. */
@:keep
class GenericHooks {
	@:next.hook
	@:next.exportHook
	public static function useSelection<Value>(items:Array<Value>):Selection<Value> {
		final index = React.useState(0);
		return {
			items: items,
			index: index.value,
			select: next -> index.set(next)
		};
	}
}
