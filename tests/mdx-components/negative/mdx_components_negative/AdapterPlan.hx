package mdx_components_negative;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.client.ClientComponentMacro;
import nextjshx.mdx.MdxComponentsMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/mdx-components/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.41.0+8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78", "16.2.12");
		ClientComponentMacro.install();
		MdxComponentsMacro.install();
		return macro null;
	}
}
#end
