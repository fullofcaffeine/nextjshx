package environment_boundaries;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.boundary.EnvironmentBoundaryMacro;

/** Installs the boundary pass and selects one isolated negative declaration. */
class BoundaryFixture {
	public static macro function install():Expr {
		EnvironmentBoundaryMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("environment_boundary_case");
		if (name == null) {
			Context.fatalError("The environment_boundary_case define is required by the negative boundary fixture.", Context.currentPos());
		}
		final typeName = switch name {
			case "client-headers": "ClientHeaders";
			case "client-server-only": "ClientServerOnly";
			case "server-client-only": "ServerClientOnly";
			case "conflicting-boundaries": "ConflictingBoundaries";
			case _:
				Context.fatalError('Unknown environment boundary fixture case "$name".', Context.currentPos());
		};
		Context.getType('environment_boundaries.negative.$typeName');
		return macro null;
	}
}
#end
