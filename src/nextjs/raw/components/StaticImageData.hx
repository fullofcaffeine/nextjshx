package nextjs.raw.components;

/** Build-time metadata returned by a supported static image import. */
@:ts.type("import('next/image').StaticImageData")
typedef StaticImageData = {
	final src:String;
	final height:Int;
	final width:Int;
	@:optional var blurDataURL:String;
	@:optional var blurWidth:Int;
	@:optional var blurHeight:Int;
}
