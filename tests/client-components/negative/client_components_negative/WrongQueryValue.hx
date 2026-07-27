package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** Replacement intent remains checked against the selected parser value. */
class WrongQueryValue {
	@:next.hook
	public static function useInvalid():Void {
		final page = Nuqs.useQueryState("page", Parsers.integer(1));
		page.set("two");
	}
}
