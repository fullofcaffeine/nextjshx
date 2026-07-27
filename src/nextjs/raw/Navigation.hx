package nextjs.raw;

import nextjs.raw.navigation.AppRouterInstance;
import nextjs.raw.navigation.Never;
import nextjs.raw.navigation.ReadonlyURLSearchParams;
import nextjs.raw.navigation.RedirectType;
import nextjs.raw.navigation.RedirectType.RedirectRuntimeType;
import nextjs.raw.navigation.RedirectType.RedirectTypes;

/** Faithful namespace binding for the reviewed `next/navigation` exports. */
@:jsRequire("next/navigation")
extern class Navigation {
	/** Runtime literal object exported by Next for redirect history behavior. */
	static final RedirectType:RedirectTypes;

	static function forbidden():Never;
	static function notFound():Never;
	@:overload(function(url:String, type:RedirectType):Never {})
	static function permanentRedirect(url:String, ?type:RedirectRuntimeType):Never;
	@:overload(function(url:String, type:RedirectType):Never {})
	static function redirect(url:String, ?type:RedirectRuntimeType):Never;
	static function unauthorized():Never;

	/**
	 * Reads route params, inferring a fixed Haxe record from the assignment target
	 * when one is supplied. Next's own generic constraint remains the TypeScript
	 * oracle for the emitted call.
	 */
	@:next.hook
	static function useParams<T>():T;

	@:next.hook
	static function usePathname():String;
	@:next.hook
	static function useRouter():AppRouterInstance;
	@:next.hook
	static function useSearchParams():ReadonlyURLSearchParams;
	@:next.hook
	static function useSelectedLayoutSegment(?parallelRouteKey:String):Null<String>;
	@:next.hook
	static function useSelectedLayoutSegments(?parallelRouteKey:String):Array<String>;
}
