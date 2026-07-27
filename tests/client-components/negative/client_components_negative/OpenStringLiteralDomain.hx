package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** Plain String is open-ended and cannot prove a closed URL-state model. */
class OpenStringLiteralDomain {
	@:next.hook
	public static function useInvalid():Void {
		Nuqs.useQueryState("view", Parsers.stringLiteral(["all", "done"], "all"));
	}
}
