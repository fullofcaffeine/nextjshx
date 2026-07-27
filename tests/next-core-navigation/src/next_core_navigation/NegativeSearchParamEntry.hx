package next_core_navigation;

import nextjs.raw.navigation.ReadonlyURLSearchParams.SearchParamEntry;

/** Proves each URL-search entry slot remains a checked string in Haxe. */
class NegativeSearchParamEntry {
	static function main():Void {}

	static function replaceKey(entry:SearchParamEntry):Void {
		entry.first = 1;
	}
}
