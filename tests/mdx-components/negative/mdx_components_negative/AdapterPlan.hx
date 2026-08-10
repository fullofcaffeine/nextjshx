package mdx_components_negative;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.client.ClientComponentMacro;
import nextjshx.mdx.MdxComponentsMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/mdx-components/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c", "16.2.12");
		ClientComponentMacro.install();
		MdxComponentsMacro.install();
		return macro null;
	}
}
#end
