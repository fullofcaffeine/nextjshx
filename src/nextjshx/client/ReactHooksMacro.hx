package nextjshx.client;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
#end

/**
 * Compile-time implementation of Next-specific React operations.
 *
 * Framework-neutral Hook authoring lives in `genes.react`. This module owns
 * only cached-resource `use` and Transition calls that NextJsHx must compose
 * with its Client Component and React Server Component boundary rules.
 *
 * These are module functions because the macro implementation has no runtime
 * identity, instance state, inheritance, or other class-level contract.
 */
#if macro
function use(resource:Expr):Expr {
	final position = Context.currentPos();
	return macro @:pos(position) nextjshx.client.ReactHookBindings.use($resource);
}

function startTransition(scope:Expr):Expr {
	final position = Context.currentPos();
	return macro @:pos(position) nextjshx.client.ReactHookBindings.startTransition($scope);
}
#end
