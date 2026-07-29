package client_components.client;

import genes.react.React.useState;

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
		final index = useState(0);
		return {
			items: items,
			index: index.value,
			select: next -> index.set(next)
		};
	}
}
