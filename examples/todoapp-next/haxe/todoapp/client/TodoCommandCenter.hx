package todoapp.client;

import genes.react.Element;
import nextjs.raw.navigation.AppRouterInstance;
import showcase.ui.Button.ButtonType;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.UiButton;
import showcase.ui.Aria.AriaHasPopup;
import showcase.ui.Command.UiCommandDialog;
import showcase.ui.Command.UiCommandEmpty;
import showcase.ui.Command.UiCommandGroup;
import showcase.ui.Command.UiCommandInput;
import showcase.ui.Command.UiCommandItem;
import showcase.ui.Command.UiCommandList;
import showcase.ui.Command.UiCommandSeparator;
import todoapp.app.TodoDetailPage;
import todoapp.client.TodoDiscovery.TodoDiscoveryModel;
import todoapp.client.TodoDiscovery.TodoPriorityFilter;
import todoapp.client.TodoDiscovery.TodoStatusFilter;
import todoapp.client.TodoDiscovery.TodoView;
import todoapp.domain.Todo;

typedef TodoCommandCenterProps = {
	final open:Bool;
	final setOpen:Bool->Void;
	final discovery:TodoDiscoveryModel;
	final visibleTodos:Array<Todo>;
	final router:AppRouterInstance;
}

/**
 * Closed command identities keep package search values out of application
 * dispatch. A contextual command carries the already-checked Todo payload.
 */
private enum abstract TodoCommand(String) {
	final FocusCreate = "focus-create";
	final FocusSearch = "focus-search";
	final ResetLens = "reset-lens";
	final StatusAll = "status-all";
	final StatusOpen = "status-open";
	final StatusDone = "status-done";
	final PriorityAll = "priority-all";
	final PriorityCritical = "priority-critical";
	final PriorityImportant = "priority-important";
	final PriorityRoutine = "priority-routine";
	final ViewList = "view-list";
	final ViewBoard = "view-board";
}

private enum abstract TodoFocusTarget(String) to String {
	final Trigger = "todo-command-trigger";
	final Create = "todo-title";
	final Search = "todo-search";
}

/**
 * Renders the keyboard command surface inside the existing client boundary.
 *
 * cmdk owns accessible dialog/list behavior. Haxe owns the command algebra,
 * URL-backed intent calls, route construction, and exhaustive dispatch. This
 * is a module function because it has no component boundary or class identity
 * of its own; the surrounding `SortableTodoList` Client Component owns
 * hydration.
 */
function render(props:TodoCommandCenterProps):Element {
	final moveItems = [
		commandItem(TodoCommand.FocusCreate, props),
		commandItem(TodoCommand.FocusSearch, props)
	];
	final lensItems = [
		commandItem(TodoCommand.StatusAll, props),
		commandItem(TodoCommand.StatusOpen, props),
		commandItem(TodoCommand.StatusDone, props),
		commandItem(TodoCommand.PriorityAll, props),
		commandItem(TodoCommand.PriorityCritical, props),
		commandItem(TodoCommand.PriorityImportant, props),
		commandItem(TodoCommand.PriorityRoutine, props),
		commandItem(TodoCommand.ViewList, props),
		commandItem(TodoCommand.ViewBoard, props),
		commandItem(TodoCommand.ResetLens, props)
	];
	final todoItems:Array<Element> = [];
	for (todo in props.visibleTodos) {
		todoItems.push(todoCommandItem(todo, props));
	}
	final updateOpen = function(next:Bool):Void {
		props.setOpen(next);
	};
	// Read the structural field once at its authored position. The resulting
	// local lets source-TSX cleanup print direct props without reordering a
	// potentially observable JavaScript property read.
	final dialogOpen = props.open;

	return <section className="command-register" aria-labelledby="command-register-title">
			<div className="command-register-copy">
				<p className="eyebrow">Keyboard desk / typed intents</p>
				<div><h2 id="command-register-title">Move without leaving the ledger.</h2><p>Search commands, change the shareable lens, or open a visible field note from one focused surface.</p></div>
			</div>
			<UiButton
				id="todo-command-trigger"
				type={ButtonType.Button}
				variant={ButtonVariant.Outline}
				className="command-trigger"
				ariaHasPopup={AriaHasPopup.Dialog}
				onClick={_ -> props.setOpen(true)}
			>
				<span>Open command desk</span><kbd aria-label="Control or Command plus K"><span aria-hidden="true">⌘</span>K</kbd>
			</UiButton>
			<UiCommandDialog
				open={dialogOpen}
				onOpenChange={updateOpen}
				modKShortcut
				returnFocusId={TodoFocusTarget.Trigger}
				label="Field Ledger command desk"
				loop
				overlayClassName="command-overlay"
				contentClassName="command-dialog"
			>
				<header className="command-dialog-head">
					<p className="eyebrow">Field Ledger / Command desk</p>
					<p>Type an intent. Every lens change stays in the URL.</p>
				</header>
				<UiCommandInput placeholder="Search moves, lenses, and visible notes…" autoFocus />
				<UiCommandList label="Available Field Ledger commands">
					<UiCommandEmpty><p>No command matches this coordinate.</p><span>Try “open”, “board”, or a field-note title.</span></UiCommandEmpty>
					<UiCommandGroup heading="Move">{moveItems}</UiCommandGroup>
					<UiCommandSeparator />
					<UiCommandGroup heading="Lens">{lensItems}</UiCommandGroup>
					<UiCommandSeparator />
					<UiCommandGroup heading="Visible field notes">{todoItems}</UiCommandGroup>
				</UiCommandList>
				<footer className="command-dialog-foot"><span><kbd>↑↓</kbd> survey</span><span><kbd>↵</kbd> commit</span><span><kbd>esc</kbd> close</span></footer>
			</UiCommandDialog>
		</section>;
}

/**
 * Builds one cmdk item from a closed command identity.
 *
 * The callback captures the enum value rather than redispatching untrusted
 * search text, while cmdk continues to own selection and keyboard behavior.
 */
function commandItem(command:TodoCommand, props:TodoCommandCenterProps):Element {
	final commandValue = value(command);
	final commandLabel = label(command);
	final commandDescription = description(command);
	// cmdk searches an explicit value instead of deriving text from children.
	// Always include what the user can actually read, then add domain aliases.
	final commandKeywords = [commandLabel, commandDescription].concat(keywords(command));
	final commandFocusTarget = focusTarget(command);
	final commandCode = code(command);
	final select = function(_value:String):Void {
		execute(command, props);
	};

	return <UiCommandItem
			key={commandValue}
			value={commandValue}
			keywords={commandKeywords}
			focusTargetId={commandFocusTarget}
			onSelect={select}
		>
			<span className="command-item-code" aria-hidden="true">{commandCode}</span>
			<span className="command-item-copy"><strong>{commandLabel}</strong><small>{commandDescription}</small></span>
		</UiCommandItem>;
}

/** A dedicated function fixes the contextual identity to one checked Todo. */
function todoCommandItem(todo:Todo, props:TodoCommandCenterProps):Element {
	final itemValue = "todo:open:" + todo.id;
	final itemKeywords = [
		todo.title,
		todo.note,
		todo.priority.value(),
		todo.completed ? "complete" : "open"
	];
	final itemPriority = todo.priority.value();
	final itemLabel = "Open “" + todo.title + "”";
	final itemNote = todo.note;
	final select = function(_value:String):Void {
		openTodo(todo, props);
	};

	return <UiCommandItem
			key={itemValue}
			value={itemValue}
			keywords={itemKeywords}
			onSelect={select}
		>
			<span className="command-item-code" aria-hidden="true">{itemPriority}</span>
			<span className="command-item-copy"><strong>{itemLabel}</strong><small>{itemNote}</small></span>
		</UiCommandItem>;
}

/**
 * Exhaustively applies one command to URL state, focus, view, or navigation.
 *
 * Adding a command requires updating this dispatcher; native router and DOM
 * focus operations remain visible at their exact call sites.
 */
function execute(command:TodoCommand, props:TodoCommandCenterProps):Void {
	switch command {
		case FocusCreate:
			props.setOpen(false);
		case FocusSearch:
			props.setOpen(false);
		case ResetLens:
			props.discovery.resetFilters();
			props.setOpen(false);
		case StatusAll:
			props.discovery.selectStatus(TodoStatusFilter.All);
			props.setOpen(false);
		case StatusOpen:
			props.discovery.selectStatus(TodoStatusFilter.Open);
			props.setOpen(false);
		case StatusDone:
			props.discovery.selectStatus(TodoStatusFilter.Done);
			props.setOpen(false);
		case PriorityAll:
			props.discovery.selectPriority(TodoPriorityFilter.All);
			props.setOpen(false);
		case PriorityCritical:
			props.discovery.selectPriority(TodoPriorityFilter.Critical);
			props.setOpen(false);
		case PriorityImportant:
			props.discovery.selectPriority(TodoPriorityFilter.Important);
			props.setOpen(false);
		case PriorityRoutine:
			props.discovery.selectPriority(TodoPriorityFilter.Routine);
			props.setOpen(false);
		case ViewList:
			props.discovery.selectView(TodoView.List);
			props.setOpen(false);
		case ViewBoard:
			props.discovery.selectView(TodoView.Board);
			props.setOpen(false);
	}
}

function openTodo(todo:Todo, props:TodoCommandCenterProps):Void {
	props.setOpen(false);
	props.router.push(TodoDetailPage.href({id: todo.id}));
}

function focusTarget(command:TodoCommand):TodoFocusTarget {
	return switch command {
		case FocusCreate: TodoFocusTarget.Create;
		case FocusSearch: TodoFocusTarget.Search;
		case ResetLens | StatusAll | StatusOpen | StatusDone | PriorityAll | PriorityCritical | PriorityImportant | PriorityRoutine | ViewList | ViewBoard:
			TodoFocusTarget.Trigger;
	};
}

function value(command:TodoCommand):String {
	return switch command {
		case FocusCreate: "move:create";
		case FocusSearch: "move:search";
		case ResetLens: "lens:reset";
		case StatusAll: "lens:status:all";
		case StatusOpen: "lens:status:open";
		case StatusDone: "lens:status:done";
		case PriorityAll: "lens:priority:all";
		case PriorityCritical: "lens:priority:P0";
		case PriorityImportant: "lens:priority:P1";
		case PriorityRoutine: "lens:priority:P2";
		case ViewList: "lens:view:list";
		case ViewBoard: "lens:view:board";
	};
}

function code(command:TodoCommand):String {
	return switch command {
		case FocusCreate: "N";
		case FocusSearch: "/";
		case ResetLens: "00";
		case StatusAll: "A";
		case StatusOpen: "O";
		case StatusDone: "C";
		case PriorityAll: "P*";
		case PriorityCritical: "P0";
		case PriorityImportant: "P1";
		case PriorityRoutine: "P2";
		case ViewList: "L";
		case ViewBoard: "B";
	};
}

function label(command:TodoCommand):String {
	return switch command {
		case FocusCreate: "File a new field note";
		case FocusSearch: "Focus ledger search";
		case ResetLens: "Reset the lens";
		case StatusAll: "Show all work";
		case StatusOpen: "Show open work";
		case StatusDone: "Show completed work";
		case PriorityAll: "Show every priority";
		case PriorityCritical: "Show critical work";
		case PriorityImportant: "Show important work";
		case PriorityRoutine: "Show routine work";
		case ViewList: "Use the ordered list";
		case ViewBoard: "Use the status board";
	};
}

function description(command:TodoCommand):String {
	return switch command {
		case FocusCreate: "Move to the validated intake form.";
		case FocusSearch: "Continue typing in the URL-backed search field.";
		case ResetLens: "Return status, priority, view, and search to defaults.";
		case StatusAll | StatusOpen | StatusDone: "Write the chosen status to the shareable URL.";
		case PriorityAll | PriorityCritical | PriorityImportant | PriorityRoutine: "Write the chosen priority to the shareable URL.";
		case ViewList: "Return to one sortable ordered ledger.";
		case ViewBoard: "Survey open and completed status lanes.";
	};
}

function keywords(command:TodoCommand):Array<String> {
	return switch command {
		case FocusCreate: ["new", "create", "add", "capture", "intake"];
		case FocusSearch: ["find", "query", "filter", "lookup"];
		case ResetLens: ["clear", "default", "all", "remove filters"];
		case StatusAll: ["status", "any", "everything"];
		case StatusOpen: ["status", "active", "unfinished"];
		case StatusDone: ["status", "done", "complete", "archive"];
		case PriorityAll: ["priority", "any", "everything"];
		case PriorityCritical: ["priority", "P0", "urgent", "critical"];
		case PriorityImportant: ["priority", "P1", "important"];
		case PriorityRoutine: ["priority", "P2", "routine"];
		case ViewList: ["view", "list", "order", "sortable"];
		case ViewBoard: ["view", "board", "lanes", "kanban"];
	};
}
