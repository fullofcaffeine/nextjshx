package nextjs.cache;

#if macro
import haxe.macro.Expr;
import nextjshx.cache.CacheFunctionMacro;
#end

/** Compile-time access to a generated native cached-function boundary. */
class CacheFunction {
	/** Preserves the selected Haxe signature while importing its directive wrapper. */
	public static macro function ref(implementation:Expr):Expr {
		return CacheFunctionMacro.reference(implementation);
	}
}
