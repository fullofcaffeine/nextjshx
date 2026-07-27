package nextjs.raw.components;

/** Exact props returned for the underlying native image element. */
@:ts.type("ReturnType<typeof import('next/image').getImageProps>['props']")
extern class NativeImageProps {
	final src:String;
	final srcSet:Null<String>;
	final sizes:Null<String>;
	final width:Null<Float>;
	final height:Null<Float>;
}

/** Result of the public `getImageProps` helper. */
@:ts.type("ReturnType<typeof import('next/image').getImageProps>")
typedef GetImagePropsResult = {
	final props:NativeImageProps;
}

/** Faithful default-import component binding for `next/image`. */
@:jsRequire("next/image", "default")
@:genes.jsxComponentProps("nextjs.raw.components.ImageProps.ImagePropsFields")
extern class Image {
	@:jsRequire("next/image", "getImageProps")
	static function getImageProps(props:ImageProps):GetImagePropsResult;
}
