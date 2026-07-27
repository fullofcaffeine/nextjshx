package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** The semantic Hook rejects keys that could change between renders. */
class DynamicQueryKey {
	@:next.hook
	public static function useInvalid(key:String):Void {
		Nuqs.useQueryState(key, Parsers.string());
	}
}
