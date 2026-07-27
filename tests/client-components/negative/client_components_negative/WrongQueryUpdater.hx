package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** Updater intent must return the parser value or the explicit clear arm. */
class WrongQueryUpdater {
	@:next.hook
	public static function useInvalid():Void {
		final page = Nuqs.useQueryState("page", Parsers.integer(1));
		page.update(current -> "page-" + current);
	}
}
