package nextjs.client;

#if macro
import haxe.macro.Expr;
#end

/**
 * Next-specific React operations for Haxe-authored Client Components and Hooks.
 *
 * Framework-neutral Hooks such as `useState`, `useMemo`, and `useOptimistic`
 * live in `genes.react.React` and should be imported from there. This module
 * retains only the reviewed Next/React contracts whose legality depends on
 * NextJsHx's cached-resource and Client Component policy.
 */
/** Runs imperative optimistic or non-urgent updates in a React Transition. */
macro function startTransition(scope:Expr):Expr {
	return nextjshx.client.ReactHooksMacro.startTransition(scope);
}

/** Reads a reviewed cached Promise or React Context using React `use`. */
macro function use(resource:Expr):Expr {
	return nextjshx.client.ReactHooksMacro.use(resource);
}
