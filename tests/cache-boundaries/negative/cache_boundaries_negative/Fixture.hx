package cache_boundaries_negative;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.cache.CacheFunctionMacro;

class Fixture {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/cache-boundaries/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.41.0+0b7a4ca9d10682baeeb6a457ac666a02b7dc2376", "16.2.12");
		PageLayoutMacro.install();
		CacheFunctionMacro.install();
		final name = Context.definedValue("cache_boundary_case");
		if (name == null) {
			Context.fatalError("The cache_boundary_case define is required.", Context.currentPos());
		}
		final typeName = switch name {
			case "request-api": "RequestApi";
			case "missing-capability": "MissingCapability";
			case "private-capability": "PrivateCapability";
			case "sync-function": "SyncFunction";
			case "class-argument": "ClassArgument";
			case "sync-page": "SyncPage";
			case "segment-dynamic-params": "CacheDynamicParams";
			case "segment-revalidate": "CacheRevalidate";
			case "raw-implementation": "RawImplementation";
			case _:
				Context.fatalError('Unknown cache boundary case "$name".', Context.currentPos());
		};
		Context.getType('cache_boundaries_negative.$typeName');
		return macro null;
	}

	static function main():Void {}
}
#else
class Fixture {
	static function main():Void {}
}
#end
