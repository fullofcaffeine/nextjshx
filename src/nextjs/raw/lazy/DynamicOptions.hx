package nextjs.raw.lazy;

import nextjs.raw.react.ReactNode;

/** State supplied to a dynamic component's loading renderer. */
typedef DynamicLoadingProps = {
	@:optional var error:Null<js.lib.Error>;
	@:optional var isLoading:Bool;
	@:optional var pastDelay:Bool;
	@:optional var retry:Void->Void;
	@:optional var timedOut:Bool;
}

typedef DynamicOptionsFields<Props> = {
	@:optional var loading:DynamicLoadingProps->ReactNode;
	@:optional var loader:Loader<Props>;
	@:optional var ssr:Bool;
}

/**
 * Stable application-authored options for `next/dynamic`.
 *
 * Next's build-generated `loadableGenerated`/loader-map seam is intentionally
 * omitted because it contains an internal `any` boundary and is not a public
 * application authoring contract.
 */
@:ts.type("Omit<import('next/dynamic').DynamicOptions<$0>, 'loader' | 'loadableGenerated' | 'webpack' | 'modules'> & { loader?: import('next/dynamic').Loader<$0> }")
abstract DynamicOptions<Props>(DynamicOptionsFields<Props>) from DynamicOptionsFields<Props> {}
