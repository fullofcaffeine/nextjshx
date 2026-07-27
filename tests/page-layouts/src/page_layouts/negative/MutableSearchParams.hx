package page_layouts.negative;

import nextjs.route.SearchParams;

class MutableSearchParams {
	public static function mutate(params:SearchParams):Void {
		params["q"] = "unsafe";
	}
}
