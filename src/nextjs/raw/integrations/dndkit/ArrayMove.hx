package nextjs.raw.integrations.dndkit;

/** Direct immutable array movement helper from dnd-kit's public helper package. */
extern class ArrayMove {
	@:jsRequire("@dnd-kit/helpers", "arrayMove")
	static function move<Item>(items:Array<Item>, from:Int, to:Int):Array<Item>;
}
