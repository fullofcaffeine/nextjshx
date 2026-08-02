package mdx_components;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.client.ClientComponentMacro;
import nextjshx.mdx.MdxComponentsMacro;

class AdapterPlan {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/mdx-components/.tmp/plan.json", "0.0.0-development", "4.3.7", "1.41.0+0b7a4ca9d10682baeeb6a457ac666a02b7dc2376",
			"16.2.12");
		ClientComponentMacro.install();
		MdxComponentsMacro.install();
		return macro null;
	}
}
#end
