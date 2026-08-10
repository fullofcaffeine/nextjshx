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
		AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c", "16.2.12");
		PageLayoutMacro.install();
		SpecialFileMacro.install();
		RouteHandlerMacro.install();
		ProxyMacro.install();
		return macro null;
	}
}
#end
