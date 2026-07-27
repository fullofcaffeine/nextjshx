package app;

import genes.ts.Undefinable;

/** Closed outbound query schema shared by the generated ProductPage companion. */
@:structInit
class ProductQuery {
	public final page:Int;
	public final preview:Undefinable<Bool>;
	@:next.queryName("tag")
	public final tags:Array<String>;

	public inline function new(page:Int, preview:Undefinable<Bool>, tags:Array<String>) {
		this.page = page;
		this.preview = preview;
		this.tags = tags;
	}
}
