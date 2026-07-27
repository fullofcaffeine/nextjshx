package client_components_negative;

/** Export publication cannot turn an ordinary function into a reviewed Hook. */
class UnreviewedHookExport {
	@:next.exportHook
	public static function useLabel(value:String):String {
		return value;
	}
}
