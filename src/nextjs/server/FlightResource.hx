package nextjs.server;

#if macro
import haxe.macro.Expr;
import nextjshx.boundary.FlightPromiseMacro;
#end

/** Server-only construction entry point for reviewed React Flight resources. */
class FlightResource {
	/**
	 * Creates a module-stable React 19 Promise capability.
	 *
	 * This macro is valid only in a static field initializer on an explicit
	 * `@:next.serverOnly` owner.
	 */
	public static macro function promise(value:Expr):Expr {
		return FlightPromiseMacro.module(value);
	}
}
