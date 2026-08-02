package page_layouts;

import genes.ts.Undefinable;
import page_layouts.positive.DynamicPage;
import page_layouts.positive.GroupedPage;
import page_layouts.positive.InterceptedPage;
import page_layouts.positive.ModuleProductPage.href as moduleProductHref;
import page_layouts.positive.ParallelPage;
import page_layouts.positive.RootPage;

/** Inert entry point that proves page href companions exist without app output. */
class NoRuntime {
	static function retain(value:String):Void {}

	static function main():Void {
		retain(RootPage.href());
		retain(DynamicPage.href({id: "42"}));
		retain(GroupedPage.href({id: "spring offer"}));
		retain(ParallelPage.href());
		retain(InterceptedPage.href({id: "hero photo"}));
		retain(moduleProductHref({id: "featured"}));
		final preview:Undefinable<Bool> = Undefinable.absent();
		retain(DynamicPage.hrefWithQuery({id: "42"}, {page: 2, preview: preview, tags: ["haxe", "next"]}));
	}
}
