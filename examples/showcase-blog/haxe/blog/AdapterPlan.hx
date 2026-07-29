package blog;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.app.SpecialFileMacro;

/**
 * Installs the compile-time planners used by this example.
 *
 * The HXML invokes this module function before typing application code. It
 * records the pinned toolchain contract, then asks the page/layout and special
 * file macros to discover the annotated Haxe owners and close one deterministic
 * adapter plan. Nothing here is emitted into the browser or server runtime.
 *
 * This is temporary application-visible compiler scaffolding: normal product
 * setup should eventually synthesize it. Keeping it as a module function makes
 * that tooling role explicit and avoids inventing a class with no instances or
 * runtime identity.
 */
macro function install():Expr {
	AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.41.0+8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78", "16.2.12");
	PageLayoutMacro.install();
	SpecialFileMacro.install();
	return macro null;
}
#end
