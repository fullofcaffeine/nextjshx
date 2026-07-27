package next_components;

import genes.react.Element;
import genes.ts.Unknown;
import nextjs.raw.DynamicComponent;
import nextjs.raw.components.Form;
import nextjs.raw.components.FormProps;
import nextjs.raw.components.FormProps.SyncFormAction;
import nextjs.raw.components.Image;
import nextjs.raw.components.ImageLoaderProps;
import nextjs.raw.components.ImageProps;
import nextjs.raw.components.Link;
import nextjs.raw.components.LinkProps;
import nextjs.raw.components.Script;
import nextjs.raw.components.ScriptProps;
import nextjs.raw.components.StaticImageData;
import nextjs.raw.lazy.DynamicOptions;
import nextjs.raw.lazy.Loader;
import nextjs.raw.font.FontTypes.FontDisplay;
import nextjs.raw.font.FontTypes.NextFont;
import nextjs.raw.font.FontTypes.NextFontWithVariable;
import nextjs.raw.font.Google;
import nextjs.raw.font.GoogleOptions.GoogleStaticWeight;
import nextjs.raw.font.GoogleOptions.GoogleWeight;
import nextjs.raw.font.GoogleOptions.InterAxis;
import nextjs.raw.font.GoogleOptions.InterOptions;
import nextjs.raw.font.GoogleOptions.InterOptionsWithVariable;
import nextjs.raw.font.GoogleOptions.InterSubset;
import nextjs.raw.font.GoogleOptions.RobotoAxis;
import nextjs.raw.font.GoogleOptions.RobotoOptions;
import nextjs.raw.font.GoogleOptions.RobotoSubset;
import nextjs.raw.font.Local;
import nextjs.raw.font.LocalFontOptions;
import nextjs.raw.font.LocalFontOptions.LocalFontFallback;
import nextjs.raw.font.LocalFontOptions.LocalFontOptionsWithVariable;
import nextjs.raw.react.ComponentType;
import nextjs.raw.react.Suspense;
import nextjs.raw.react.Suspense.SuspenseProps;
import nextjs.raw.server.WebFormData;

typedef CardProps = {
	final label:String;
}

/** Initial default-import and TSX integration probe for B04. */
@:keep
class ComponentConsumer {
	static function main():Void {
		consume(render());
		consume(SemanticComponentConsumer.render());
		consume(imageProps());
		consume(staticImage());
		consume(imageLoader({src: "/hero.png", width: 640}));
		consume(inter());
		consume(interVariable());
		consume(roboto());
		consume(local());
		consume(localVariable());
		consume(scriptCallbacks());
		consume(renderSuspense());
	}

	public static function render():Element {
		final props:LinkProps<String> = {
			href: "/products",
			prefetch: LinkPrefetchMode.Auto,
			transitionTypes: ["navigation"]
		};
		final status = Link.useLinkStatus();
		consume(status.pending);
		final image:ImageProps = {
			src: "/hero.png",
			alt: "NextJsHx",
			width: 640,
			height: "360",
			loading: ImageLoading.Lazy,
			placeholder: ImagePlaceholder.Blur
		};
		final form:FormProps<String> = {
			action: formAction(),
			prefetch: FormPrefetch.Disabled,
			scroll: false
		};
		return <main>
			<Link href={props.href} prefetch={props.prefetch} transitionTypes={props.transitionTypes}>Products</Link>
			<Image {...image} />
			<Form action={form.action} prefetch={form.prefetch} scroll={form.scroll}><button type={"submit"}>Search</button></Form>
			<Script src="https://example.test/widget.js" strategy={ScriptStrategy.LazyOnload} onLoad={() -> {}} stylesheets={["https://example.test/widget.css"]} />
		</main>;
	}

	public static function formAction():SyncFormAction {
		return (formData:WebFormData) -> consume(formData.has("query"));
	}

	public static function scriptCallbacks():ScriptProps {
		return {
			src: "https://example.test/widget.js",
			strategy: ScriptStrategy.LazyOnload,
			onLoad: event -> consumeUnknown(event)
		};
	}

	public static function dynamicCard(loader:Loader<CardProps>):ComponentType<CardProps> {
		final options:DynamicOptions<CardProps> = {
			loader: loader,
			loading: state -> state.isLoading == true ? "Loading" : "Waiting",
			ssr: false
		};
		return DynamicComponent.load(options);
	}

	public static function renderDynamic(Card:ComponentType<CardProps>):Element {
		return <Card label={"Loaded"} />;
	}

	public static function renderSuspense():Element {
		final fallback:Element = <p>Loading inventory</p>;
		return <Suspense fallback={fallback} name="inventory"><p>Inventory ready</p></Suspense>;
	}

	public static function imageProps():String {
		return Image.getImageProps({
			src: "/hero.png",
			alt: "NextJsHx",
			width: 640,
			height: 360
		}).props.src;
	}

	public static function staticImage():StaticImageData {
		return {src: "/hero.png", width: 640, height: 360};
	}

	public static function imageLoader(input:ImageLoaderProps):String {
		return input.src + "?w=" + input.width;
	}

	public static function inter():NextFont {
		final options:InterOptions = {
			weight: [GoogleStaticWeight.W400, GoogleStaticWeight.W700],
			display: FontDisplay.Swap,
			subsets: [InterSubset.Latin],
			axes: [InterAxis.OpticalSize]
		};
		return Google.inter(options);
	}

	public static function interVariable():NextFontWithVariable {
		final options:InterOptionsWithVariable = {
			weight: GoogleWeight.Variable,
			variable: "--font-inter",
			subsets: [InterSubset.LatinExt]
		};
		return Google.inter(options);
	}

	public static function roboto():NextFont {
		final options:RobotoOptions = {
			weight: GoogleWeight.W400,
			subsets: [RobotoSubset.Math],
			axes: [RobotoAxis.Width]
		};
		return Google.roboto(options);
	}

	public static function local():NextFont {
		final options:LocalFontOptions = {
			src: "./Brand.woff2",
			display: FontDisplay.Fallback,
			adjustFontFallback: LocalFontFallback.Arial
		};
		return Local.load(options);
	}

	public static function localVariable():NextFontWithVariable {
		final options:LocalFontOptionsWithVariable = {
			src: [
				{path: "./Brand-Regular.woff2", weight: "400"},
				{path: "./Brand-Bold.woff2", weight: "700"}
			],
			variable: "--font-brand"
		};
		return Local.load(options);
	}

	static function consumeUnknown(_:Unknown):Void {}

	static function consume<T>(_:T):Void {}
}
