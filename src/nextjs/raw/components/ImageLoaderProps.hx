package nextjs.raw.components;

/** Input supplied to a custom Next Image loader. */
@:ts.type("import('next/image').ImageLoaderProps")
typedef ImageLoaderProps = {
	final src:String;
	final width:Int;
	@:optional var quality:Int;
}
