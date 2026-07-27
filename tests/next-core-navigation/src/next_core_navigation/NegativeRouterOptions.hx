package next_core_navigation;

import nextjs.raw.Navigation;

/** Must fail in Haxe: `scroll` is boolean, never a truthy string. */
class NegativeRouterOptions {
	static function main():Void {
		Navigation.useRouter().push("/", {scroll: "yes"});
	}
}
