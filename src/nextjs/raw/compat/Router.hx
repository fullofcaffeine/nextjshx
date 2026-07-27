package nextjs.raw.compat;

/** Nullable Pages/App Router migration instance. */
@:ts.type("NonNullable<ReturnType<typeof import('next/compat/router').useRouter>>")
extern class CompatRouterInstance {
	final route:String;
	final pathname:String;
	final asPath:String;
	final isReady:Bool;
	function back():Void;
	function forward():Void;
	function reload():Void;
}

/** Migration-only nullable router namespace from `next/compat/router`. */
@:jsRequire("next/compat/router")
extern class Router {
	@:next.hook
	static function useRouter():Null<CompatRouterInstance>;
}
