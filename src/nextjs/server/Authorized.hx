package nextjs.server;

/**
 * Immutable Haxe evidence that one guarded pipeline allowed this exact context.
 *
 * This value is intentionally not a Server Function transport type. Only
 * `GuardedAction` may invoke its Haxe constructor after every required callback
 * succeeds. Importing generated implementation modules is not a supported
 * native TypeScript capability boundary.
 */
class Authorized<Operation:ActionOperation, Actor, Target, Input> {
	public final operation:Operation;
	public final actor:Actor;
	public final target:Target;
	public final input:Input;

	@:allow(nextjs.server.GuardedAction)
	private function new(operation:Operation, actor:Actor, target:Target, input:Input) {
		this.operation = operation;
		this.actor = actor;
		this.target = target;
		this.input = input;
	}
}

/** Non-generic module owner for Next's native server-only poison marker. */
@:next.serverOnly
private class AuthorizedBoundary {}
