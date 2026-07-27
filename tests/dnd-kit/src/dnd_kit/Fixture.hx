package dnd_kit;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.client.ReactDiagnosticsMacro;

class Fixture {
	public static macro function install():Expr {
		ReactDiagnosticsMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("dnd_kit_case");
		if (name == null) {
			Context.fatalError("The dnd_kit_case define is required.", Context.currentPos());
		}
		final typeName = switch name {
			case "wrong-id": "WrongId";
			case "wrong-index": "WrongIndex";
			case "wrong-callback": "WrongCallback";
			case "wrong-ref-value": "WrongRefValue";
			case "wrong-ref-target": "WrongRefTarget";
			case "outside-hook": "OutsideHook";
			case _:
				Context.fatalError('Unsupported dnd-kit fixture case "$name".', Context.currentPos());
		};
		Context.getType('dnd_kit.$typeName');
		switch name {
			case "wrong-callback":
				Context.typeExpr(macro dnd_kit.WrongCallback.render());
			case "wrong-ref-value":
				Context.typeExpr(macro dnd_kit.WrongRefValue.render());
			case "wrong-ref-target":
				Context.typeExpr(macro dnd_kit.WrongRefTarget.render());
			case _:
		}
		return macro null;
	}
}
#end
