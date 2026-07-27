package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

private enum abstract EmptyLiteralView(String) to String {
	final All = "all";
}

/** A closed URL domain must expose at least one accepted runtime value. */
class EmptyStringLiteralValues {
	@:next.hook
	public static function useInvalid():Void {
		Nuqs.useQueryState("view", Parsers.stringLiteral([], EmptyLiteralView.All));
	}
}
