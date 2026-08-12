package mdx_components;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.client.ClientComponentMacro;
import nextjshx.mdx.MdxComponentsMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/mdx-components/.tmp/plan.json", "0.0.0-development", "4.3.7", "1.50.0+603ed8349775f86438a8b5be99cafa1a36544644",
			"16.2.12");
		ClientComponentMacro.install();
		MdxComponentsMacro.install();
		return macro null;
	}
}
#end
