package cache_boundaries;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.cache.CacheFunctionMacro;
import nextjshx.route.RouteHandlerMacro;

class AdapterPlan {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.41.0+8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78", "16.2.12");
		PageLayoutMacro.install();
		RouteHandlerMacro.install();
		CacheFunctionMacro.install();
		return macro null;
	}
}
#end
