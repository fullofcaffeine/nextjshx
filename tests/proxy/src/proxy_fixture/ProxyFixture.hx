package proxy_fixture;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.server.ProxyMacro;

class ProxyFixture {
	public static macro function install(outputPath:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.38.2+f0ffa29e6d49fe81541977c6a3aae6b80000cec6", "16.2.12");
		ProxyMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("proxy_case");
		if (name == null) {
			Context.fatalError("The proxy_case define is required by the negative proxy fixture.", Context.currentPos());
		}
		final typeName = switch name {
			case "missing-function": "MissingFunction";
			case "wrong-request": "WrongRequest";
			case "wrong-return": "WrongReturn";
			case "matcher-expression": "MatcherExpression";
			case "duplicate-matcher": "DuplicateMatcher";
			case "extra-public": "ExtraPublic";
			case "boundary-conflict": "BoundaryConflict";
			case _:
				Context.fatalError('Unknown proxy fixture case "$name".', Context.currentPos());
		};
		Context.getType('proxy_fixture.negative.$typeName');
		return macro null;
	}
}
#end
