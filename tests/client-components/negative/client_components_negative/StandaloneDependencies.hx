package client_components_negative;

import nextjs.client.React;

/** `deps` is compile-time syntax owned by a direct semantic `useMemo` call. */
class StandaloneDependencies {
	@:next.hook
	public static function useInvalid(value:Int):Void {
		React.deps(value);
	}
}
