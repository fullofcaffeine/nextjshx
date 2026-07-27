package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

private enum abstract StoredLiteralView(String) to String {
	final All = "all";
	final Done = "done";
}

/** A stored array hides the closed URL domain from compile-time review. */
class StoredStringLiteralValues {
	@:next.hook
	public static function useInvalid():Void {
		final values = [StoredLiteralView.All, StoredLiteralView.Done];
		Nuqs.useQueryState("view", Parsers.stringLiteral(values, StoredLiteralView.All));
	}
}
