package nextjs.raw.components;

import haxe.extern.EitherType;

/** Module-shaped static import accepted by Next Image. */
@:ts.type("{ default: import('next/image').StaticImageData }")
typedef StaticImageModule = {
	@:native("default") final image:StaticImageData;
}

/** A public URL or supported static-image import. */
typedef ImageSource = EitherType<String, EitherType<StaticImageData, StaticImageModule>>;

/** Numeric image dimensions may use either number or numeric-string syntax. */
@:ts.type("number | `$${number}`")
abstract ImageDimension(EitherType<Float, String>) from Float from String {}

/** Custom image loader callback. */
typedef ImageLoader = ImageLoaderProps->String;

/** Browser loading behavior supported by Next Image. */
@:ts.type("'eager' | 'lazy'")
enum abstract ImageLoading(String) to String {
	final Eager = "eager";
	final Lazy = "lazy";
}

/**
 * Placeholder values supported by Next Image.
 *
 * `Blur` and `Empty` are discoverable constants. Data image strings remain a
 * raw string input and are independently checked by Next's template-literal
 * type in emitted TypeScript.
 */
@:ts.type("'blur' | 'empty' | `data:image/$${string}`")
enum abstract ImagePlaceholder(String) from String to String {
	final Blur = "blur";
	final Empty = "empty";
}

/** React CSS properties retained through the public React type. */
@:ts.type("import('react').CSSProperties")
abstract ImageStyle({}) from {} {}

typedef ImagePropsFields = {
	final src:ImageSource;
	final alt:String;
	@:optional var width:ImageDimension;
	@:optional var height:ImageDimension;
	@:optional var fill:Bool;
	@:optional var loader:ImageLoader;
	@:optional var quality:ImageDimension;
	@:optional var preload:Bool;
	@:optional var priority:Bool;
	@:optional var loading:ImageLoading;
	@:optional var placeholder:ImagePlaceholder;
	@:optional var blurDataURL:String;
	@:optional var unoptimized:Bool;
	@:optional var overrideSrc:String;
	@:optional var onLoadingComplete:js.html.ImageElement->Void;
	@:optional var className:String;
	@:optional var sizes:String;
	@:optional var style:ImageStyle;
}

/** Faithful public props for the optimized Next Image component. */
@:ts.type("import('next/image').ImageProps")
typedef ImageProps = ImagePropsFields;
