package client_components_negative;

import genes.react.React.deps;

/** `deps` is compile-time syntax owned by a direct semantic `useMemo` call. */
class StandaloneDependencies {
	@:next.hook
	public static function useInvalid(value:Int):Void {
		deps(value);
	}
}
