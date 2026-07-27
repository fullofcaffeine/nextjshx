package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** Empty query keys fail before package code or generated output exists. */
class EmptyQueryKey {
	@:next.hook
	public static function useInvalid():Void {
		Nuqs.useQueryState("", Parsers.string());
	}
}
