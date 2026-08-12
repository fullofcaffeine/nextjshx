package mixed_adoption_negative;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.client.ClientComponentMacro;

class Fixture {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/mixed-adoption/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.50.0+603ed8349775f86438a8b5be99cafa1a36544644", "16.2.12");
		ClientComponentMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		Context.getType("mixed_adoption_negative.UnsafeCallbackProps");
		return macro null;
	}
}
#end
