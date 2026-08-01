package next_stable;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.app.SpecialFileMacro;
import nextjshx.route.RouteHandlerMacro;
import nextjshx.server.ProxyMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.41.0+0b7a4ca9d10682baeeb6a457ac666a02b7dc2376", "16.2.12");
		PageLayoutMacro.install();
		SpecialFileMacro.install();
		RouteHandlerMacro.install();
		ProxyMacro.install();
		return macro null;
	}
}
#end
