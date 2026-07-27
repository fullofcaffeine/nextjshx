package nextjs.server;

#if macro
import haxe.macro.Expr;
import nextjshx.server.ServerFunctionMacro;
#end

/** Compile-time authoring entry point for a native generated Server Function ref. */
class ServerFunction {
	/**
	 * Preserves the selected action's Haxe signature while importing its
	 * generated `"use server"` export instead of the raw implementation module.
	 */
	public static macro function ref(action:Expr):Expr {
		return ServerFunctionMacro.reference(action);
	}

	/**
	 * Returns the same generated action import with nominal React Flight
	 * provenance, for passing a Server Function through Client Component props.
	 *
	 * Ordinary callbacks cannot acquire this type by matching its function
	 * shape; only this validated direct-action macro constructs it.
	 */
	public static macro function boundary(action:Expr):Expr {
		return ServerFunctionMacro.reference(action, true);
	}
}
