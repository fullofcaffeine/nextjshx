package todoapp.client;

import genes.react.Element;
import nextjs.components.NextForm;
import genes.react.React.useOptimistic;
import nextjs.raw.components.FormProps;
import nextjs.server.ServerFunction;
import showcase.ui.Button.ButtonProps;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;
import todoapp.actions.TodoActions;
import todoapp.domain.TodoId;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;
import todoapp.mutations.TodoMutationState.TodoMutationPhase;

typedef TodoRowActionsProps = {
	final id:TodoId;
	final completed:Bool;
	final title:String;
}

private enum abstract RowOptimisticAction(String) {
	final Toggle = "toggle";
	final Remove = "remove";
}

private typedef OptimisticRow = {
	final completed:Bool;
	final visible:Bool;
}

/** Per-record hydrated controls; authorization still lives inside each action. */
@:next.clientComponent
class TodoRowActions {
	/**
	 * Wires toggle/remove Server Function refs to one Todo row.
	 *
	 * Each mutation gets independent pending/retry state and optimistic UI.
	 * React and Next still own action transport; Haxe keeps operation and result
	 * values closed and prevents direct client imports of server bodies.
	 */
	public static function render(props:TodoRowActionsProps):Element {
		final initial:OptimisticRow = {completed: props.completed, visible: true};
		final optimistic = useOptimistic(initial, reduceOptimisticRow);
		final toggle = MutationHook.useTodoMutation(ServerFunction.ref(TodoActions.toggle), TodoMutationOperation.Toggle, "Status action ready.",
			_formData -> optimistic.apply(RowOptimisticAction.Toggle));
		final remove = MutationHook.useTodoMutation(ServerFunction.ref(TodoActions.remove), TodoMutationOperation.Remove, "Removal action ready.",
			_formData -> optimistic.apply(RowOptimisticAction.Remove));
		final toggleForm:FormProps<String> = {action: toggle.action, className: "row-action-form"};
		final removeForm:FormProps<String> = {action: remove.action, className: "row-action-form"};
		final toggleButton:ButtonProps = {
			variant: ButtonVariant.Outline,
			size: ButtonSize.Small,
			type: ButtonType.Submit,
			disabled: toggle.pending || remove.pending || toggle.state.retryable || remove.state.retryable || !toggle.online,
			className: "row-action toggle-action",
			ariaLabel: (props.completed ? "Reopen " : "Complete ") + props.title
		};
		final removeButton:ButtonProps = {
			variant: ButtonVariant.Destructive,
			size: ButtonSize.Small,
			type: ButtonType.Submit,
			disabled: toggle.pending || remove.pending || toggle.state.retryable || remove.state.retryable || !remove.online,
			className: "row-action remove-action",
			ariaLabel: "Delete " + props.title
		};
		final status = remove.pending || remove.state.phase != TodoMutationPhase.Ready ? remove.state : toggle.state;
		final pending = toggle.pending || remove.pending;
		final online = toggle.online && remove.online;
		final failed = status.phase == TodoMutationPhase.Rejected || status.phase == TodoMutationPhase.TransportFailure;
		final statusMessage = !online ? "Offline. Reconnect before changing this note." : pending ? "Saving optimistic change…" : status.message;
		final retry = status.operation == TodoMutationOperation.Remove ? remove.retry : toggle.retry;
		final canRetry = status.operation == TodoMutationOperation.Remove ? remove.canRetry : toggle.canRetry;
		final optimisticCompleted = optimistic.value.completed;
		final optimisticVisible = optimistic.value.visible;
		final rowPending = pending;
		final rowClass = "row-actions";
		return <div className={rowClass} data-optimistic-completed={optimisticCompleted} data-optimistic-visible={optimisticVisible} aria-busy={rowPending}>
			<div className="row-action-buttons">
					<NextForm {...toggleForm}><input type="hidden" name="id" value={props.id} /><UiButton {...toggleButton}>{toggle.pending ? "Updating…" : optimistic.value.completed ? "Reopen" : "Complete"}</UiButton></NextForm>
					<NextForm {...removeForm}><input type="hidden" name="id" value={props.id} /><UiButton {...removeButton}>{remove.pending ? "Removing…" : "Delete"}</UiButton></NextForm>
			</div>
			<div className="row-action-feedback">
				<p className={failed ? "row-action-status is-error" : "row-action-status"} data-phase={status.phase} aria-live="polite">{statusMessage}</p>
				<button type="button" className="mutation-retry" hidden={!status.retryable} disabled={!canRetry} onClick={_ -> retry()}>Retry safely</button>
			</div>
		</div>;
	}

	static function reduceOptimisticRow(current:OptimisticRow, action:RowOptimisticAction):OptimisticRow {
		return switch action {
			case Toggle: {completed: !current.completed, visible: current.visible};
			case Remove: {completed: current.completed, visible: false};
		};
	}
}
