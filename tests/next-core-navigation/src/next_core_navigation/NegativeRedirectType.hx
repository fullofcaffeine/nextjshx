package next_core_navigation;

import nextjs.raw.Navigation;
import nextjs.raw.navigation.RedirectType;

/** Must fail in Haxe: redirect behavior is a closed two-literal union. */
class NegativeRedirectType {
	static function main():Void {
		final invalid:RedirectType = "reload";
		Navigation.redirect("/", invalid);
	}
}
