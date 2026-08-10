package app;

#if nextjshx_css_module_tracer
import app.styles.HaxePageStyles;
import genes.css.CssModule.imported;
#end
import genes.react.Element;
import genes.ts.Undefinable;
import nextjs.app.PageProps;
import nextjs.app.SegmentConfig;
import nextjs.app.SegmentRuntime;
import nextjs.raw.metadata.Metadata;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;

/** Haxe-owned `/haxe` page reached through a generated Next-native adapter. */
@:next.page("haxe")
class HaxePage {
	public static final metadata:Metadata = {
		title: "Static metadata from Haxe",
		description: "A typed Haxe field becomes a native Next.js metadata export."
	};

	public static final segment = SegmentConfig.create({
		runtime: SegmentRuntime.NodeJs,
		preferredRegion: "home",
		revalidate: false,
		maxDuration: 5
	});

	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		#if nextjshx_css_module_tracer
		// Genes checks each field against a generated closed type. Next.js still
		// loads the ordinary CSS Module and decides the final class-name values.
		final styles:HaxePageStyles = imported("./haxe-page.module.css", "styles");
		#end
		final preview:Undefinable<Bool> = Undefinable.absent();
		final productHref = ProductPage.hrefWithQuery({slug: "first"}, {
			page: 2,
			preview: preview,
			tags: ["haxe next", "typed"]
		});
		final pageCopy = "This page implementation originated in typed Haxe.";
		#if nextjshx_css_module_tracer
		return <main id={"haxe-page"} className={styles.card} data-error-class={styles.errorState}>
      <p>{pageCopy}</p>
      <a id={"typed-query-link"} href={productHref}>Typed product query</a>
    </main>;
		#else
		return <main id={"haxe-page"}>
      <p>{pageCopy}</p>
      <a id={"typed-query-link"} href={productHref}>Typed product query</a>
    </main>;
		#end
	}
}
