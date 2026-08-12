package server_functions_negative;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.boundary.EnvironmentBoundaryMacro;
import nextjshx.server.ServerFunctionMacro;

class Fixture {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/server-functions/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.50.0+603ed8349775f86438a8b5be99cafa1a36544644", "16.2.12");
		EnvironmentBoundaryMacro.install();
		ServerFunctionMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("server_function_case");
		if (name == null) {
			Context.fatalError("The server_function_case define is required.", Context.currentPos());
		}
		final typeName = switch name {
			case "sync-action": "SyncAction";
			case "class-argument": "ClassArgument";
			case "unknown-result": "UnknownResult";
			case "optional-argument": "OptionalArgument";
			case "bad-path": "BadPath";
			case "unmarked-public": "UnmarkedPublic";
			case "invalid-ref": "InvalidRef";
			case "raw-action-client": "RawActionClient";
			case "private-witness": "PrivateWitness";
			case "wrong-operation": "WrongOperation";
			case "missing-authorizer": "MissingAuthorizer";
			case "witness-result": "WitnessResult";
			case "broad-operation": "BroadOperation";
			case _:
				Context.fatalError('Unknown Server Function fixture case "$name".', Context.currentPos());
		};
		Context.getType('server_functions_negative.$typeName');
		return macro null;
	}
}
#end
