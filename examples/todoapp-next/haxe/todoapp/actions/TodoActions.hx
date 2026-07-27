package todoapp.actions;

import js.lib.Promise;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.raw.Cache;
import nextjs.raw.server.WebFormData;
import todoapp.cache.TodoCacheTag;
import todoapp.domain.TodoId;
import todoapp.input.TodoInputCodecs;
import todoapp.mutations.TodoMutationState;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;
import todoapp.mutations.TodoMutationState.TodoMutationStates;
import todoapp.persistence.TodoStore;

/**
 * Native todo mutations with closed FormData decoding and serializable results.
 *
 * This deterministic fixture deliberately has no user identity. Production
 * actions must authenticate the current actor and authorize the exact todo
 * inside every action, before calling the persistence layer. Hiding a button
 * in the client is never an authorization boundary.
 */
@:next.serverFunctions("actions/todos")
class TodoActions {
	@:next.action
	@:async
	public static function create(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch TodoInputCodecs.draftMutationForm(formData) {
			case Decoded(input):
				if (TodoStore.wasApplied(Create, input.mutationId)) {
					replayed(Create);
				} else {
					final draft = input.payload;
					final created = TodoStore.create(draft.title, draft.note, draft.priority);
					TodoStore.rememberApplied(Create, input.mutationId);
					Cache.updateTag(TodoCacheTag.current());
					TodoMutationStates.completed(Create, 'Filed "${created.title}" as ${created.id}.');
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Create, "Review the marked intake fields.", issues);
		};
	}

	@:next.action
	@:async
	public static function toggle(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch TodoInputCodecs.idMutationForm(formData) {
			case Decoded(input):
				if (TodoStore.wasApplied(Toggle, input.mutationId)) {
					replayed(Toggle);
				} else if (!TodoStore.toggle(input.payload)) {
					missing(Toggle, input.payload);
				} else {
					TodoStore.rememberApplied(Toggle, input.mutationId);
					Cache.updateTag(TodoCacheTag.current());
					TodoMutationStates.completed(Toggle, "Status updated in the shared ledger.");
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Toggle, "The status request was rejected.", issues);
		};
	}

	@:next.action
	@:async
	public static function remove(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch TodoInputCodecs.idMutationForm(formData) {
			case Decoded(input):
				if (TodoStore.wasApplied(Remove, input.mutationId)) {
					replayed(Remove);
				} else if (!TodoStore.remove(input.payload)) {
					missing(Remove, input.payload);
				} else {
					TodoStore.rememberApplied(Remove, input.mutationId);
					Cache.updateTag(TodoCacheTag.current());
					TodoMutationStates.completed(Remove, "Record removed from the shared ledger.");
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Remove, "The removal request was rejected.", issues);
		};
	}

	@:next.action
	@:async
	public static function reorder(_previous:TodoMutationState, formData:WebFormData):Promise<TodoMutationState> {
		return switch TodoInputCodecs.orderMutationForm(formData) {
			case Decoded(input):
				if (TodoStore.wasApplied(Reorder, input.mutationId)) {
					replayed(Reorder);
				} else if (!TodoStore.reorder(input.payload)) {
					TodoMutationStates.rejected(Reorder, "The ledger changed before this order could be saved.", [
						{
							code: DecodeIssueCode.InvalidValue,
							path: "form.id",
							message: "ordered ids must be an exact permutation of the current ledger"
						}
					]);
				} else {
					TodoStore.rememberApplied(Reorder, input.mutationId);
					Cache.updateTag(TodoCacheTag.current());
					TodoMutationStates.completed(Reorder, "Ledger order committed.");
				}
			case Rejected(issues):
				TodoMutationStates.rejected(Reorder, "The reorder request was rejected.", issues);
		};
	}

	static function replayed(operation:TodoMutationOperation):TodoMutationState {
		Cache.updateTag(TodoCacheTag.current());
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
