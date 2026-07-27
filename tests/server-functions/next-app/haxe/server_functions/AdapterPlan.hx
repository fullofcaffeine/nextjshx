package server_functions;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.client.ClientComponentMacro;
import nextjshx.server.ServerFunctionMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.38.2+f0ffa29e6d49fe81541977c6a3aae6b80000cec6", "16.2.12");
		PageLayoutMacro.install();
		ClientComponentMacro.install();
		ServerFunctionMacro.install();
		return macro null;
	}
}
#end
