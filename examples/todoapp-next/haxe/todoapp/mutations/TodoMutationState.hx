package todoapp.mutations;

import nextjs.codec.DecodeIssue;

/** Closed mutation lifecycle shared across the server and hydrated UI. */
enum abstract TodoMutationPhase(String) to String {
	final Ready = "ready";
	final Succeeded = "succeeded";
	final Rejected = "rejected";
	final TransportFailure = "transport-failure";
}

/** Closed operation identity used by state, retry receipts, and UI copy. */
enum abstract TodoMutationOperation(String) to String {
	final Create = "create";
	final Toggle = "toggle";
	final Remove = "remove";
	final Reorder = "reorder";

	public static function parse(value:String):Null<TodoMutationOperation> {
		return switch value {
			case "create": Create;
			case "toggle": Toggle;
			case "remove": Remove;
			case "reorder": Reorder;
			case _: null;
		};
	}
}

/** Closed, React-serializable state shared by every todo mutation flow. */
typedef TodoMutationState = {
	final phase:TodoMutationPhase;
	final operation:TodoMutationOperation;
	final message:String;
	final issues:Array<DecodeIssue>;
	final retryable:Bool;
}

/** Deterministic state constructors shared by server actions and client views. */
@:next.shared
class TodoMutationStates {
	public static function ready(operation:TodoMutationOperation, message:String):TodoMutationState {
		return {
			phase: Ready,
			operation: operation,
			message: message,
			issues: [],
			retryable: false
		};
	}

	public static function rejected(operation:TodoMutationOperation, message:String, issues:Array<DecodeIssue>):TodoMutationState {
		return {
			phase: Rejected,
			operation: operation,
			message: message,
			issues: issues,
			retryable: false
		};
	}

	public static function completed(operation:TodoMutationOperation, message:String):TodoMutationState {
		return {
			phase: Succeeded,
			operation: operation,
			message: message,
			issues: [],
			retryable: false
		};
	}

	public static function transportFailure(operation:TodoMutationOperation):TodoMutationState {
		return {
			phase: TransportFailure,
			operation: operation,
			message: "The network did not confirm this change. Reconnect and retry safely.",
			issues: [],
			retryable: true
		};
	}
}
