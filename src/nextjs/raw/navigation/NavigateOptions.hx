package nextjs.raw.navigation;

/** Stable options shared by App Router `push` and `replace`. */
@:ts.type("NonNullable<Parameters<ReturnType<typeof import('next/navigation').useRouter>['push']>[1]>")
typedef NavigateOptions = {
	@:optional var scroll:Bool;
	@:optional var transitionTypes:Array<String>;
}
