package todoapp.client;

import js.Browser;
import js.lib.Promise;
import nextjs.client.React;
import nextjs.raw.Navigation;
import nextjs.raw.react.React as RawReact;
import nextjs.raw.server.WebFormData;
import todoapp.mutations.TodoMutationState;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;
import todoapp.mutations.TodoMutationState.TodoMutationPhase;
import todoapp.mutations.TodoMutationState.TodoMutationStates;

typedef TodoServerMutation = (previous:TodoMutationState, formData:WebFormData) -> Promise<TodoMutationState>;

typedef TodoMutationModel = {
	final state:TodoMutationState;
	final action:WebFormData->Void;
	final submit:WebFormData->Void;
	final retry:Void->Void;
	final pending:Bool;
	final online:Bool;
	final canRetry:Bool;
}

@:native("navigator")
private extern class OnlineNavigator {
	static final onLine:Bool;
}

/**
 * Haxe-authored React 19 mutation state, optimistic replay, and retry policy.
 *
 * Refs close the pre-render double-submit window without scheduling extra
 * renders. Transport errors are deliberately discarded and converted to a
 * closed user-facing state before they can cross the application boundary.
 *
 * This Hook has no class identity. The shell remains only because the current
 * analyzer bridge lifts a public static field into a native module function;
 * direct module-Hook authoring is a reusable `genes.react` prerequisite.
 */
class MutationHook {
	/**
	 * Coordinates one Server Function with optimistic replay and safe retry.
	 *
	 * Refs close the double-submit window, cloned FormData keeps retries
	 * repeatable, and all thrown/transport failures become a closed mutation
	 * state. React 19 still owns `useActionState`, transitions, and rendering.
	 */
	@:next.hook
	public static function useTodoMutation(action:TodoServerMutation, operation:TodoMutationOperation, readyMessage:String,
			optimistic:WebFormData->Void):TodoMutationModel {
		final router = Navigation.useRouter();
		final instanceId = RawReact.useId();
		final sequence = RawReact.useRef(0);
		final active = RawReact.useRef(false);
		final lastSubmission = RawReact.useRef((null : Null<WebFormData>));
		final online = RawReact.useSyncExternalStore(subscribeOnline, readOnline, readServerOnline);
		final initialState = TodoMutationStates.ready(operation, readyMessage);
		final execute = React.useCallback((previous:TodoMutationState, formData:WebFormData) -> {
			try {
				return action(previous, formData).then(result -> {
					if (result.phase == TodoMutationPhase.Succeeded) {
						router.refresh();
					}
					active.current = false;
					return result;
				}, _error -> {
					active.current = false;
					return TodoMutationStates.transportFailure(operation);
				});
			} catch (_:haxe.Exception) {
				active.current = false;
				return Promise.resolve(TodoMutationStates.transportFailure(operation));
			}
		}, React.deps(action, operation, router));
		final actionState = RawReact.useActionState(execute, initialState);
		final state = actionState.first;
		final dispatch = actionState.second;
		final pending = actionState.third;
		final actionSubmission = React.useCallback((formData:WebFormData) -> {
			if (active.current || pending) {
				return;
			}
			active.current = true;
			sequence.current += 1;
			final submission = cloneFormData(formData);
			submission.set("mutationId", '$operation:$instanceId:${sequence.current}');
			lastSubmission.current = cloneFormData(submission);
			optimistic(cloneFormData(submission));
			dispatch(submission);
		}, React.deps(dispatch, instanceId, operation, optimistic, pending));
		final submit = React.useCallback((formData:WebFormData) -> {
			React.startTransition(() -> actionSubmission(formData));
		}, React.deps(actionSubmission));
		final retry = React.useCallback(() -> {
			final saved = lastSubmission.current;
			if (saved == null || active.current || pending || !online || !state.retryable) {
				return;
			}
			active.current = true;
			final submission = cloneFormData(saved);
			React.startTransition(() -> {
				optimistic(cloneFormData(submission));
				dispatch(submission);
			});
		}, React.deps(dispatch, online, optimistic, pending, state.retryable));
		return {
			state: state,
			action: actionSubmission,
			submit: submit,
			retry: retry,
			pending: pending,
			online: online,
			canRetry: state.retryable && online && !pending};
	}

	static function subscribeOnline(listener:Void->Void):Void->Void {
		final notify = (_:js.html.Event) -> listener();
		Browser.window.addEventListener("online", notify);
		Browser.window.addEventListener("offline", notify);
		return () -> {
			Browser.window.removeEventListener("online", notify);
			Browser.window.removeEventListener("offline", notify);
		};
	}

	static function readOnline():Bool {
		return OnlineNavigator.onLine;
	}

	static function readServerOnline():Bool {
		return true;
	}

	static function cloneFormData(source:WebFormData):WebFormData {
		final clone = new WebFormData();
		source.forEach((value, name, _source) -> clone.appendEntry(name, value));
		return clone;
	}
}
