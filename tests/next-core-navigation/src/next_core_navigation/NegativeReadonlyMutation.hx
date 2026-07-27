package next_core_navigation;

import nextjs.raw.Navigation;

/** Must fail in Haxe: Next's inherited mutation method throws at runtime. */
class NegativeReadonlyMutation {
	static function main():Void {
		Navigation.useSearchParams().set("q", "unsafe");
	}
}
