package server_functions;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.client.ClientComponentMacro;
import nextjshx.server.ServerFunctionMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.50.0+603ed8349775f86438a8b5be99cafa1a36544644", "16.2.12");
		PageLayoutMacro.install();
		ClientComponentMacro.install();
		ServerFunctionMacro.install();
		return macro null;
	}
}
#end
