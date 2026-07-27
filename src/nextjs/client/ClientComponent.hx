package nextjs.client;

#if macro
import haxe.macro.Expr;
import nextjshx.client.ClientComponentMacro;
#end

/** Compile-time access to a generated Client Component boundary. */
class ClientComponent {
	/**
	 * Static-extension form of `ref`: with
	 * `using nextjs.client.ClientComponent`, expands `Component.client()` into
	 * the precise generated client boundary for the consuming module.
	 */
	public static macro function client(implementation:Expr):Expr {
		return ClientComponentMacro.reference(implementation);
	}

	/**
	 * Returns a precisely typed component import from the generated `use client`
	 * adapter while erasing the raw implementation token from the server graph.
	 * This central form remains source-compatible; new code normally uses the
	 * discoverable `Component.client()` extension above.
	 */
	public static macro function ref(implementation:Expr):Expr {
		return ClientComponentMacro.reference(implementation);
	}
}
