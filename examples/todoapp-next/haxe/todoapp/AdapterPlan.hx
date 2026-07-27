package todoapp;

#if macro
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.app.SpecialFileMacro;
import nextjshx.boundary.EnvironmentBoundaryMacro;
import nextjshx.cache.CacheFunctionMacro;
import nextjshx.client.ClientComponentMacro;
import nextjshx.route.RouteHandlerMacro;
import nextjshx.server.ServerFunctionMacro;

/**
 * Installs the production-shaped example's compile-time adapter planners.
 *
 * The HXML invokes this module function before application typing. It records
 * the exact toolchain contract and enables each semantic owner used by Field
 * Ledger: routes, special files, environment boundaries, Client Components,
 * Server Functions, Route Handlers, and cached functions. The planners close a
 * deterministic generation plan; this installer itself never reaches the
 * browser or Next.js server runtime.
 *
 * Setup tooling should eventually synthesize this plumbing. Until then a
 * module function communicates its compiler-only role without inventing a
 * class that has no instances or runtime identity.
 */
macro function install():Expr {
	AdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.38.2+f0ffa29e6d49fe81541977c6a3aae6b80000cec6", "16.2.12");
	PageLayoutMacro.install();
	SpecialFileMacro.install();
	EnvironmentBoundaryMacro.install();
	ClientComponentMacro.install();
	ServerFunctionMacro.install();
	RouteHandlerMacro.install();
	CacheFunctionMacro.install();
	return macro null;
}
#end
