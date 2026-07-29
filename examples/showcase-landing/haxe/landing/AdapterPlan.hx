package landing;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.client.ClientComponentMacro;

/**
 * Installs this example's compile-time adapter planners.
 *
 * The HXML calls this module function before typing. It records the pinned
 * toolchain contract and enables discovery of page/layout and Client Component
 * owners. Planning is a compiler-only concern, so no redundant installer class
 * or runtime JavaScript value is created.
 */
macro function install():Expr {
	AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.41.0+8a7f7aaf3227fdee79a3cbd25d90ef2c99975f78", "16.2.12");
	PageLayoutMacro.install();
	ClientComponentMacro.install();
	return macro null;
}
#end
