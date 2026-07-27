package nextjs.raw.navigation;

/**
 * Stable callable subset of the App Router instance returned by `useRouter`.
 *
 * The type projection points through the public hook rather than importing an
 * internal `next/dist` interface. `prefetch` intentionally exposes its stable
 * one-argument form: Next 16.2.12's optional second argument leaks an internal
 * enum that `next/navigation` does not export.
 */
@:ts.type("ReturnType<typeof import('next/navigation').useRouter>")
extern class AppRouterInstance {
	function back():Void;
	function forward():Void;
	function refresh():Void;
	function push(href:String, ?options:NavigateOptions):Void;
	function replace(href:String, ?options:NavigateOptions):Void;
	function prefetch(href:String):Void;
}
