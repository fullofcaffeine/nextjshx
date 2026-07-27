package todoapp.persistence;

import js.lib.Error;
import todoapp.domain.Todo;
import todoapp.domain.TodoId;
import todoapp.domain.TodoPriority;
import todoapp.mutations.TodoMutationId;
import todoapp.mutations.TodoMutationState.TodoMutationOperation;

using StringTools;
using Lambda;

/**
 * Lists records from the fixed-schema file repository and tracked seed.
 *
 * Every read opens the file again, so independent Next workers observe the same
 * deterministic bytes instead of relying on process-local mutable state.
 * Repository operations are module functions because there is no store object
 * or class identity; call sites import only the operations they use.
 */
inline final DEFAULT_CONTROL_PATH = ".nextjshx";

inline final RUNS_PATH = ".nextjshx/runs";
inline final SEED_PATH = "data/seed.tsv";
inline final HEADER = "id\tcompleted\tpriority\ttitle\tnote";
inline final RECEIPT_HEADER = "operation\tmutation_id";
var writeSequence = 0;

function list():Array<Todo> {
	final state = statePath();
	final source = NodeFiles.existsSync(state) ? state : SEED_PATH;
	return decode(NodeFiles.readFileSync(source, "utf8"));
}

/** Stable cache-key scope; every E2E run receives a separate value. */
function cacheScope():String {
	final runId = NodeProcess.env.NEXTJSHX_TODO_RUN_ID.orNull();
	if (runId == null || runId == "") {
		return "default";
	}
	if (!~/^[a-z0-9]+(?:-[a-z0-9]+)*$/.match(runId)) {
		return fail(0, "NEXTJSHX_TODO_RUN_ID must be a lowercase URL-safe slug");
	}
	return runId;
}

function find(id:TodoId):Null<Todo> {
	for (todo in list()) {
		if (todo.id == id) {
			return todo;
		}
	}
	return null;
}

function create(title:String, note:String, priority:TodoPriority):Todo {
	validateText(title, 120, "title", 0);
	validateText(note, 240, "note", 0);
	final todos = list();
	final todo:Todo = {
		id: nextId(title, todos),
		completed: false,
		priority: priority,
		title: title,
		note: note
	};
	todos.push(todo);
	persist(todos);
	return todo;
}

function toggle(id:TodoId):Bool {
	final todos = list();
	for (index in 0...todos.length) {
		final todo = todos[index];
		if (todo.id == id) {
			todos[index] = {
				id: todo.id,
				completed: !todo.completed,
				priority: todo.priority,
				title: todo.title,
				note: todo.note
			};
			persist(todos);
			return true;
		}
	}
	return false;
}

function remove(id:TodoId):Bool {
	final todos = list();
	final retained = todos.filter(todo -> todo.id != id);
	if (retained.length == todos.length) {
		return false;
	}
	persist(retained);
	return true;
}

/** Replaces the persisted order only when it is an exact permutation. */
function reorder(ids:Array<TodoId>):Bool {
	final current = list();
	if (ids.length != current.length) {
		return false;
	}
	final ordered:Array<Todo> = [];
	for (id in ids) {
		final match = current.find(todo -> todo.id == id);
		if (match == null || ordered.exists(todo -> todo.id == id)) {
			return false;
		}
		ordered.push(match);
	}
	persist(ordered);
	return true;
}

/** Whether this exact operation receipt was already committed. */
function wasApplied(operation:TodoMutationOperation, mutationId:TodoMutationId):Bool {
	final receipt = receiptPath();
	if (!NodeFiles.existsSync(receipt)) {
		return false;
	}
	final expected = '$operation\t$mutationId';
	return decodeReceipts(NodeFiles.readFileSync(receipt, "utf8")).indexOf(expected) != -1;
}

/**
 * Persists a successful replay receipt after the corresponding data write.
 *
 * The fixture uses one process and a synchronous store. A production database
 * must commit the domain write and an actor/tenant-scoped idempotency key in
 * one transaction; this sidecar is executable UX evidence, not that database.
 */
function rememberApplied(operation:TodoMutationOperation, mutationId:TodoMutationId):Void {
	final receipt = receiptPath();
	final receipts = NodeFiles.existsSync(receipt) ? decodeReceipts(NodeFiles.readFileSync(receipt, "utf8")) : [];
	final encoded = '$operation\t$mutationId';
	if (receipts.indexOf(encoded) != -1) {
		return;
	}
	receipts.push(encoded);
	persistReceipts(receipts);
}

/**
 * Parses the fixed TSV schema into closed Todo records.
 *
 * Every row is checked for field count, ID, boolean, priority, text bounds,
 * and duplicate identity before entering the application model. Errors name
 * the deterministic line instead of returning a partial repository.
 */
function decode(raw:String):Array<Todo> {
	final normalized = raw.replace("\r\n", "\n");
	if (normalized.indexOf("\r") != -1) {
		return fail(0, "state must use LF or CRLF line endings");
	}
	final lines = normalized.split("\n");
	if (lines.length > 0 && lines[lines.length - 1] == "") {
		lines.pop();
	}
	if (lines.length < 1 || lines[0] != HEADER) {
		return fail(1, "state must contain the exact version-1 header");
	}

	final seen:Array<String> = [];
	final todos:Array<Todo> = [];
	for (index in 1...lines.length) {
		final lineNumber = index + 1;
		final line = lines[index];
		if (line == "") {
			return fail(lineNumber, "blank records are not allowed");
		}
		final fields = line.split("\t");
		if (fields.length != 5) {
			return fail(lineNumber, "record must contain exactly five tab-separated fields");
		}

		final id = TodoId.parse(fields[0]);
		if (id == null) {
			return fail(lineNumber, "id must be a lowercase URL-safe slug of at most 64 characters");
		}
		if (seen.indexOf(fields[0]) != -1) {
			return fail(lineNumber, "ids must be unique");
		}
		seen.push(fields[0]);

		final completed = switch fields[1] {
			case "true": true;
			case "false": false;
			case _: return fail(lineNumber, "completed must be exactly true or false");
		};
		final priority = TodoPriority.parse(fields[2]);
		if (priority == null) {
			return fail(lineNumber, "priority must be exactly P0, P1, or P2");
		}
		validateText(fields[3], 120, "title", lineNumber);
		validateText(fields[4], 240, "note", lineNumber);
		todos.push({
			id: id,
			completed: completed,
			priority: priority,
			title: fields[3],
			note: fields[4]
		});
	}
	return todos;
}

function validateText(value:String, maximum:Int, label:String, lineNumber:Int):Void {
	if (value == "" || value.trim() != value || value.length > maximum || value.indexOf("\t") != -1 || value.indexOf("\n") != -1 || value.indexOf("\r") != -1) {
		fail(lineNumber, '$label must be non-empty, trimmed, single-line, and at most $maximum characters');
	}
}

/**
 * Derives a stable unused ID from the title and current repository.
 *
 * Collisions receive an increasing suffix, so identical input and state
 * produce identical IDs without process-global randomness.
 */
function nextId(title:String, todos:Array<Todo>):TodoId {
	var base = ~/[^a-z0-9]+/g.replace(title.toLowerCase(), "-");
	while (base.startsWith("-")) {
		base = base.substr(1);
	}
	while (base.endsWith("-")) {
		base = base.substr(0, base.length - 1);
	}
	if (base == "") {
		base = "field-note";
	}
	if (base.length > 54) {
		base = base.substr(0, 54);
		while (base.endsWith("-")) {
			base = base.substr(0, base.length - 1);
		}
	}

	var candidate = base;
	var suffix = 2;
	while (todos.exists(todo -> todo.id == candidate)) {
		candidate = base + "-" + suffix;
		suffix++;
	}
	final id = TodoId.parse(candidate);
	return id == null ? fail(0, "generated id violated the TodoId invariant") : id;
}

/**
 * Atomic replacement keeps test workers from observing a partial TSV file.
 * This remains a deterministic fixture store, not a concurrent production DB.
 */
function persist(todos:Array<Todo>):Void {
	final control = controlPath();
	final state = statePath();
	NodeFiles.mkdirSync(control, {recursive: true, mode: 0x1C0});
	writeSequence++;
	final temporary = '$control/todoapp-state.${NodeProcess.pid}.$writeSequence.tmp';
	final records = todos.map(todo -> [
		todo.id,
		todo.completed ? "true" : "false",
		todo.priority.value(),
		todo.title,
		todo.note
	].join("\t"));
	final encoded = HEADER + "\n" + (records.length == 0 ? "" : records.join("\n") + "\n");
	NodeFiles.writeFileSync(temporary, encoded, {encoding: "utf8", mode: 0x180});
	NodeFiles.chmodSync(temporary, 0x180);
	NodeFiles.renameSync(temporary, state);
	NodeFiles.chmodSync(state, 0x180);
}

/**
 * Parses replay receipts into a closed operation/mutation-ID set.
 *
 * Fixed headers and duplicate checks make a malformed receipt file fail as
 * a whole rather than silently disabling idempotency.
 */
function decodeReceipts(raw:String):Array<String> {
	final normalized = raw.replace("\r\n", "\n");
	if (normalized.indexOf("\r") != -1) {
		return fail(0, "mutation receipts must use LF or CRLF line endings");
	}
	final lines = normalized.split("\n");
	if (lines.length > 0 && lines[lines.length - 1] == "") {
		lines.pop();
	}
	if (lines.length < 1 || lines[0] != RECEIPT_HEADER) {
		return fail(1, "mutation receipts must contain the exact version-1 header");
	}
	final receipts:Array<String> = [];
	for (index in 1...lines.length) {
		final fields = lines[index].split("\t");
		if (fields.length != 2 || TodoMutationOperation.parse(fields[0]) == null || TodoMutationId.parse(fields[1]) == null) {
			return fail(index + 1, "mutation receipt must contain a known operation and validated replay id");
		}
		if (receipts.indexOf(lines[index]) != -1) {
			return fail(index + 1, "mutation receipts must be unique");
		}
		receipts.push(lines[index]);
	}
	return receipts;
}

function persistReceipts(receipts:Array<String>):Void {
	final control = controlPath();
	final receipt = receiptPath();
	NodeFiles.mkdirSync(control, {recursive: true, mode: 0x1C0});
	writeSequence++;
	final temporary = '$control/todoapp-mutations.${NodeProcess.pid}.$writeSequence.tmp';
	final encoded = RECEIPT_HEADER + "\n" + (receipts.length == 0 ? "" : receipts.join("\n") + "\n");
	NodeFiles.writeFileSync(temporary, encoded, {encoding: "utf8", mode: 0x180});
	NodeFiles.chmodSync(temporary, 0x180);
	NodeFiles.renameSync(temporary, receipt);
	NodeFiles.chmodSync(receipt, 0x180);
}

function controlPath():String {
	final scope = cacheScope();
	return scope == "default" ? DEFAULT_CONTROL_PATH : '$RUNS_PATH/$scope';
}

function statePath():String {
	return controlPath() + "/todoapp-state.tsv";
}

function receiptPath():String {
	return controlPath() + "/todoapp-mutations.tsv";
}

function fail<T>(lineNumber:Int, reason:String):T {
	throw new Error('Invalid todo persistence at line $lineNumber: $reason.');
}
