package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** URL delimiters are not valid semantic query-key characters. */
class InvalidQueryKey {
	@:next.hook
	public static function useInvalid():Void {
		Nuqs.useQueryState("view=active", Parsers.string("all"));
	}
}
