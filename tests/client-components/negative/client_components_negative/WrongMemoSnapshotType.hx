package client_components_negative;

import genes.react.React.useMemo;
import genes.react.React.deps;

@:keep
class WrongMemoSnapshotType {
	@:next.hook
	public static function useLabel(value:Int):String {
		return useMemo((current:String) -> current, deps(value));
	}
}
