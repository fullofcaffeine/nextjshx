package client_components_negative;

import nextjs.client.React;

@:keep
class WrongMemoSnapshotType {
	@:next.hook
	public static function useLabel(value:Int):String {
		return React.useMemo((current:String) -> current, React.deps(value));
	}
}
