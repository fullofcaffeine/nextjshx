package field_atlas;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.client.ClientComponentMacro;
import nextjshx.mdx.MdxComponentsMacro;

/**
 * Installs this example's compile-time adapter planners.
 *
 * The HXML calls this module function before typing. It records the pinned
 * toolchain contract, then enables route, Client Component, and MDX registry
 * discovery. These calls close generated adapter metadata only; no installer
 * object or function is shipped with the Next.js application.
 */
macro function install():Expr {
	AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.41.0+0b7a4ca9d10682baeeb6a457ac666a02b7dc2376", "16.2.12");
	PageLayoutMacro.install();
	ClientComponentMacro.install();
	MdxComponentsMacro.install();
	return macro null;
}
#end
