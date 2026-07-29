package commerce;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.app.SpecialFileMacro;
import nextjshx.client.ClientComponentMacro;

/**
 * Installs this example's compile-time adapter planners.
 *
 * The HXML calls this module function before typing. It records the pinned
 * toolchain contract, then enables discovery of route owners, special files,
 * and Client Components. The function contributes only to generated planning;
 * it is absent from the browser and server runtime.
 */
macro function install():Expr {
	AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.41.0+1ead794285d4f43cbbc96078d4eac4a4d8bf6cce", "16.2.12");
	PageLayoutMacro.install();
	SpecialFileMacro.install();
	ClientComponentMacro.install();
	return macro null;
}
#end
