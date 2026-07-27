package page_layouts.positive;

import genes.ts.Undefinable;

/** Closed outbound query schema used by the generated dynamic-page companion. */
@:structInit
class TodoQuery {
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
