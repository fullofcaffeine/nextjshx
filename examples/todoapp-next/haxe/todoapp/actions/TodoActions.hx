package todoapp.actions;

import js.lib.Promise;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.raw.Cache;
import nextjs.raw.server.WebFormData;
import todoapp.cache.TodoCacheTag.current;
import todoapp.domain.TodoId;
import todoapp.input.TodoInputCodecs.draftMutationForm;
import todoapp.input.TodoInputCodecs.idMutationForm;
import todoapp.input.TodoInputCodecs.orderMutationForm;
import todoapp.mutations.TodoMutationState;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;
import todoapp.mutations.TodoMutationState.TodoMutationStates;
import todoapp.persistence.TodoStore.create as createTodo;
import todoapp.persistence.TodoStore.rememberApplied;
import todoapp.persistence.TodoStore.remove as removeTodo;
import todoapp.persistence.TodoStore.reorder as reorderTodos;
import todoapp.persistence.TodoStore.toggle as toggleTodo;
import todoapp.persistence.TodoStore.wasApplied;

/**
 * Native todo mutations with closed FormData decoding and serializable results.
 *
 * This deterministic fixture deliberately has no user identity. Production
 * actions must authenticate the current actor and authorize the exact todo
 * inside every action, before calling the persistence layer. Hiding a button
 * in the client is never an authorization boundary.
 *
 * `@:next.serverFunctions("actions/todos")` publishes one directive-first
 * `"use server"` module at `app/actions/todos.ts`. Client code receives typed
 * server references, never the server implementation module.
 */
@:next.serverFunctions("actions/todos")
class TodoActions {
	/**
	 * `@:next.action` opts this method into that public Server Function module;
	 * treat it as an untrusted network entrypoint. `@:async` preserves Next's
	 * required native Promise shape. Neither annotation decodes, authenticates,
	 * authorizes, or makes the mutation idempotent—the body must do those jobs.
	 */
	@:next.action
	@:async
	public static function create(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch draftMutationForm(formData) {
			case Decoded(input):
				if (wasApplied(Create, input.mutationId)) {
					replayed(Create);
				} else {
					final draft = input.payload;
					final created = createTodo(draft.title, draft.note, draft.priority);
					rememberApplied(Create, input.mutationId);
					Cache.updateTag(current());
					TodoMutationStates.completed(Create, 'Filed "${created.title}" as ${created.id}.');
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Create, "Review the marked intake fields.", issues);
		};
	}

	@:next.action
	@:async
	public static function toggle(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch idMutationForm(formData) {
			case Decoded(input):
				if (wasApplied(Toggle, input.mutationId)) {
					replayed(Toggle);
				} else if (!toggleTodo(input.payload)) {
					missing(Toggle, input.payload);
				} else {
					rememberApplied(Toggle, input.mutationId);
					Cache.updateTag(current());
					TodoMutationStates.completed(Toggle, "Status updated in the shared ledger.");
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Toggle, "The status request was rejected.", issues);
		};
	}

	@:next.action
	@:async
	public static function remove(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch idMutationForm(formData) {
			case Decoded(input):
				if (wasApplied(Remove, input.mutationId)) {
					replayed(Remove);
				} else if (!removeTodo(input.payload)) {
					missing(Remove, input.payload);
				} else {
					rememberApplied(Remove, input.mutationId);
					Cache.updateTag(current());
					TodoMutationStates.completed(Remove, "Record removed from the shared ledger.");
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Remove, "The removal request was rejected.", issues);
		};
	}

	/**
	 * Validates the complete visible order before persisting and invalidating.
	 *
	 * Duplicate/missing IDs are rejected by the shared codec, replay receipts
	 * make retries deterministic, and native `updateTag` provides read-your-own
	 * writes. Authentication/authorization would remain explicit here in a real
	 * application.
	 */
	@:next.action
	@:async
	public static function reorder(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch orderMutationForm(formData) {
			case Decoded(input):
				if (wasApplied(Reorder, input.mutationId)) {
					replayed(Reorder);
				} else if (!reorderTodos(input.payload)) {
					TodoMutationStates.rejected(Reorder, "The ledger changed before this order could be saved.", [
						{
							code: DecodeIssueCode.InvalidValue,
							path: "form.id",
							message: "ordered ids must be an exact permutation of the current ledger"
						}
					]);
				} else {
					rememberApplied(Reorder, input.mutationId);
					Cache.updateTag(current());
					TodoMutationStates.completed(Reorder, "Ledger order committed.");
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Reorder, "The reorder request was rejected.", issues);
		};
	}

	static function replayed(operation:TodoMutationOperation):TodoMutationState {
		Cache.updateTag(current());
		return TodoMutationStates.completed(operation, "Already committed; refreshed from the shared ledger.");
	}

	static function missing(operation:TodoMutationOperation, id:TodoId):TodoMutationState {
		return TodoMutationStates.rejected(operation, "The record no longer exists.", [
			{
				code: DecodeIssueCode.InvalidValue,
				path: "form.id",
				message: 'todo "$id" was not found'
			}
		]);
	}
}
