package mixed_adoption_negative;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.client.ClientComponentMacro;

class Fixture {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/mixed-adoption/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.38.2+f0ffa29e6d49fe81541977c6a3aae6b80000cec6", "16.2.12");
		ClientComponentMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		Context.getType("mixed_adoption_negative.UnsafeCallbackProps");
		return macro null;
	}
}
#end
