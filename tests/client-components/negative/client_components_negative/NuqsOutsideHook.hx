package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.integrations.nuqs.Parsers;

/** Semantic package Hooks retain the framework Hook-placement contract. */
class NuqsOutsideHook {
	public static function ordinaryHelper():Void {
		Nuqs.useQueryState("view", Parsers.string("all"));
	}
}
