package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

private enum abstract PrimaryLiteralView(String) to String {
	final All = "all";
}

private enum abstract SecondaryLiteralView(String) to String {
	final Done = "done";
}

/** Values from separate nominal domains cannot be merged by representation. */
class MixedStringLiteralDomains {
	@:next.hook
	public static function useInvalid():Void {
		Nuqs.useQueryState("view", Parsers.stringLiteral([PrimaryLiteralView.All, SecondaryLiteralView.Done], PrimaryLiteralView.All));
	}
}
