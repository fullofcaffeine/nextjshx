package todoapp.client;

import genes.react.Element;
import nextjs.components.NextForm;
import nextjs.client.React;
import nextjs.codec.DecodeResult;
import nextjs.raw.components.FormProps;
import nextjs.server.ServerFunction;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Button.ButtonProps;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.UiButton;
import showcase.ui.Card.Card;
import showcase.ui.Card.CardContent;
import showcase.ui.Card.CardHeader;
import showcase.ui.Card.CardProps;
import showcase.ui.Input.InputProps;
import showcase.ui.Input.InputType;
import showcase.ui.Input.UiInput;
import showcase.ui.Textarea.Textarea;
import showcase.ui.Textarea.TextareaProps;
import todoapp.actions.TodoActions;
import todoapp.domain.TodoPriority;
import todoapp.input.TodoInputCodecs.draftMutationForm;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;
import todoapp.mutations.TodoMutationState.TodoMutationPhase;

using Lambda;

typedef CreateTodoFormProps = {}

private typedef OptimisticDraft = {
	final active:Bool;
	final title:String;
	final note:String;
	final priority:TodoPriority;
}

/**
 * `@:next.clientComponent` is the checked Haxe equivalent of a first-line
 * `"use client"` directive. Haxe validates props, Hooks, callbacks, and HXX;
 * the generated adapter lets React hydrate it through ordinary Next.js.
 */
@:next.clientComponent
class CreateTodoForm {
	/**
	 * Owns the create form's native action state and optimistic draft preview.
	 *
	 * The component builds real `FormData`, calls the generated Server Function
	 * reference through the shared mutation Hook, and renders closed issue
	 * paths. React/Next still own form transport and transition scheduling.
	 */
	public static function render(_props:CreateTodoFormProps):Element {
		final initialDraft:OptimisticDraft = {
			active: false,
			title: "",
			note: "",
			priority: TodoPriority.Important
		};
		final draft = React.useOptimistic(initialDraft, (_current:OptimisticDraft, next:OptimisticDraft) -> next);
		final mutation = MutationHook.useTodoMutation(ServerFunction.ref(TodoActions.create), TodoMutationOperation.Create, "Intake desk ready.",
			formData -> switch draftMutationForm(formData) {
				case Decoded(input):
					final value = input.payload;
					draft.apply({
						active: true,
						title: value.title,
						note: value.note,
						priority: value.priority
					});
				case Rejected(_): {}
			});
		final form:FormProps<String> = {
			action: mutation.action,
			id: "create-todo-form",
			className: "intake-form"
		};
		final card:CardProps = {className: "intake-card"};
		final badge:BadgeProps = {variant: BadgeVariant.Outline, className: "intake-badge"};
		final title:InputProps = {
			id: "todo-title",
			type: InputType.Text,
			name: "title",
			placeholder: "e.g. Prove mutation refresh",
			autoComplete: "off",
			maxLength: 120,
			required: true,
			disabled: mutation.pending || mutation.state.retryable,
			ariaInvalid: hasIssue(mutation.state.issues, "form.title"),
			className: "ledger-input"
		};
		final note:TextareaProps = {
			id: "todo-note",
			name: "note",
			placeholder: "What would make this record complete?",
			rows: 4,
			maxLength: 240,
			required: true,
			disabled: mutation.pending || mutation.state.retryable,
			ariaInvalid: hasIssue(mutation.state.issues, "form.note"),
			className: "ledger-input ledger-textarea"
		};
		final submit:ButtonProps = {
			type: ButtonType.Submit,
			disabled: mutation.pending || mutation.state.retryable,
			className: "intake-submit"
		};
		final issueRows = mutation.state.issues.map(issue -> <li data-code={issue.code} data-path={issue.path}><code>{issue.path}</code>{issue.message}</li>);
		final statusMessage = !mutation.online ? "Offline. Reconnect to file or retry this note." : mutation.pending ? "Filing an optimistic field note…" : mutation.state.message;
		final failed = mutation.state.phase == TodoMutationPhase.Rejected || mutation.state.phase == TodoMutationPhase.TransportFailure;
		final draftHidden = !draft.value.active;
		final draftPending = mutation.pending;
		final formPending = mutation.pending;
		return <Card {...card}>
			<CardHeader className="intake-heading">
				<div><Badge {...badge}>New field note</Badge><h2>File work while it is clear.</h2></div>
				<p>Closed-schema FormData enters a typed Haxe action; the refreshed ledger remains native Next.</p>
			</CardHeader>
			<CardContent className="intake-content">
				<div aria-busy={formPending}>
				<NextForm {...form}>
					<div className="intake-field intake-title"><label htmlFor="todo-title">Title <span>120 max</span></label><UiInput {...title} /></div>
					<div className="intake-field intake-note"><label htmlFor="todo-note">Completion note <span>240 max</span></label><Textarea {...note} /></div>
					<div className="intake-field intake-priority"><label htmlFor="todo-priority">Priority</label><select id="todo-priority" name="priority" defaultValue="P1" disabled={mutation.pending || mutation.state.retryable} aria-invalid={hasIssue(mutation.state.issues, "form.priority")}><option value="P0">P0 / critical</option><option value="P1">P1 / important</option><option value="P2">P2 / routine</option></select></div>
					<div className="intake-commit">
						<UiButton {...submit}>{mutation.pending ? "Filing…" : "File the note"}</UiButton>
						<p id="create-todo-status" className={failed ? "mutation-status is-error" : "mutation-status"} data-phase={mutation.state.phase} aria-live="polite">{statusMessage}</p>
						<button type="button" className="mutation-retry" hidden={!mutation.state.retryable} disabled={!mutation.canRetry} onClick={_ -> mutation.retry()}>Retry safely</button>
					</div>
					<ul id="create-todo-issues" className="mutation-issues">{issueRows}</ul>
				</NextForm>
				</div>
				<div className="optimistic-draft" hidden={draftHidden} data-pending={draftPending} aria-live="polite">
					<div><span>Pending receipt</span><strong>{draft.value.priority.value()}</strong></div>
					<h3>{draft.value.title}</h3><p>{draft.value.note}</p>
				</div>
			</CardContent>
		</Card>;
	}

	static function hasIssue(issues:Array<nextjs.codec.DecodeIssue>, path:String):Bool {
		return issues.exists(issue -> issue.path == path);
	}
}
