package next_core_navigation;

import genes.ts.Unknown;
import js.lib.Iterator;
import nextjs.raw.Navigation;
import nextjs.raw.NextConfig;
import nextjs.raw.Route;
import nextjs.raw.compat.Router;
import nextjs.raw.metadata.Metadata;
import nextjs.raw.metadata.ResolvingMetadata;
import nextjs.raw.metadata.ResolvingViewport;
import nextjs.raw.metadata.Viewport;
import nextjs.raw.navigation.Never;
import nextjs.raw.navigation.ReadonlyURLSearchParams.SearchParamEntry;
import nextjs.raw.navigation.RedirectType;
import nextjs.raw.navigation.RouteParams;

typedef ProductParams = {
	final id:String;
	final slug:Array<String>;
}

/** Strict generated-TypeScript parity consumer for every B03 runtime export. */
@:keep
class CoreNavigationConsumer {
	static function main():Void {
		final config:NextConfig = {
			typedRoutes: true,
			trailingSlash: false,
			output: "standalone",
			sassOptions: {implementation: "sass"}
		};
		final metadata:Metadata = {
			title: {absolute: "Products"},
			description: "Product catalog",
			openGraph: {
				title: "Products",
				description: "Product catalog"
			}
		};
		final viewport:Viewport = {
			width: "device-width",
			initialScale: 1,
			viewportFit: "cover",
			colorScheme: "dark"
		};
		final route:Route<Unknown> = "/products";

		consume(config);
		consume(metadata);
		consume(viewport);
		consume(route);

		final pathname:String = Navigation.usePathname();
		final params:RouteParams = Navigation.useParams();
		final typedParams:ProductParams = Navigation.useParams();
		final search = Navigation.useSearchParams();
		final entries:Iterator<SearchParamEntry> = search.entries();
		final segment:Null<String> = Navigation.useSelectedLayoutSegment();
		final slotSegment:Null<String> = Navigation.useSelectedLayoutSegment("modal");
		final segments:Array<String> = Navigation.useSelectedLayoutSegments();
		final slotSegments:Array<String> = Navigation.useSelectedLayoutSegments("modal");

		consume(pathname);
		consume(params);
		consume(typedParams);
		consume(search.size);
		consume(search.get("q"));
		consume(search.getAll("tag"));
		consume(search.has("q"));
		consume(search.has("q", "haxe"));
		consume(entries);
		consume(search.keys());
		consume(search.values());
		search.forEach((value, key) -> {
			consume(value);
			consume(key);
		});
		consume(search.toString());
		consume(segment);
		consume(slotSegment);
		consume(segments);
		consume(slotSegments);

		final router = Navigation.useRouter();
		router.back();
		router.forward();
		router.refresh();
		router.push("/products");
		router.push("/products", {scroll: false, transitionTypes: ["navigation"]});
		router.replace("/products", {scroll: true});
		router.prefetch("/products");

		consume(Navigation.RedirectType.push);
		consume(Navigation.RedirectType.replace);

		final compatRouter = Router.useRouter();
		if (compatRouter != null) {
			consume(compatRouter.route);
			consume(compatRouter.pathname);
			consume(compatRouter.asPath);
			consume(compatRouter.isReady);
			compatRouter.back();
			compatRouter.forward();
			compatRouter.reload();
		}
	}

	public static function keepResolvingMetadata(parent:ResolvingMetadata):ResolvingMetadata {
		return parent;
	}

	public static function keepResolvingViewport(parent:ResolvingViewport):ResolvingViewport {
		return parent;
	}

	public static function redirectPush():Never {
		return Navigation.redirect("/login", RedirectType.Push);
	}

	public static function redirectReplace():Never {
		return Navigation.redirect("/login", RedirectType.Replace);
	}

	public static function permanent():Never {
		return Navigation.permanentRedirect("/moved", Navigation.RedirectType.replace);
	}

	public static function redirectRuntimePush():Never {
		return Navigation.redirect("/login", Navigation.RedirectType.push);
	}

	public static function missing():Never {
		return Navigation.notFound();
	}

	public static function denied():Never {
		return Navigation.forbidden();
	}

	public static function unauthenticated():Never {
		return Navigation.unauthorized();
	}

	static function consume<T>(_:T):Void {}
}
