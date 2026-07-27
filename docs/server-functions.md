# Haxe Server Functions and typed action refs

NextJsHx models a native Next.js Server Function module as one concrete Haxe
class annotated with `@:next.serverFunctions(path)`. Each public action is a
static `@:next.action` plus `@:async` method. Client and server consumers obtain
the generated Next boundary through `ServerFunction.ref(ActionClass.method)`;
they never import the raw genes-ts implementation as the callable boundary.

The result is still the standard React/Next Server Function transport. NextJsHx
adds compile-time validation and a narrow generated `"use server"` adapter. It
adds no custom RPC protocol, action registry, request envelope, or application
runtime.

## Why this layer was needed

While implementing a real Haxe-authored form mutation, three mismatches became
concrete:

- a Haxe static method compiles as a class method, while Next requires an async
  module-level export in a directive-first `"use server"` file;
- referencing the implementation method directly from a Client Component
  creates the wrong module-graph edge and can expose server implementation code
  instead of the native action boundary; and
- a real React form submission adds reserved `$ACTION_*` entries to its
  `FormData`, so the ordinary exact-object form decoder correctly rejects the
  payload unless it can distinguish framework transport fields from
  application input.

The semantic layer makes those constraints explicit. The declaration macro
validates action signatures and serializability, records only a closed adapter
intent, and retains the implementation under Haxe DCE. The host renderer emits
real async named exports. The ref macro preserves the selected Haxe function
type while importing only the generated action export. Finally,
`FormDataDecoder.serverAction` ignores only Next/React's reserved `$ACTION_`
prefix and leaves the application's closed field allowlist intact.

## Positive: a native form action

Declare an extensionless adapter path relative to the App Router root. Every
action must have required, explicitly typed arguments and an explicit
`Promise<Result>` return type after `@:async` lowering.

```haxe
package example.actions;

import genes.js.Async.await;
import js.lib.Error;
import js.lib.Promise;
import nextjs.codec.DecodeResult;
import nextjs.codec.FormDataDecoder;
import nextjs.codec.TextDecoders;
import nextjs.raw.Headers;
import nextjs.raw.server.WebFormData;

@:next.serverFunctions("actions/todos")
class TodoActions {
	@:next.action
	@:async
	public static function save(formData:WebFormData):Promise<Void> {
		final title = switch FormDataDecoder.serverAction(
			formData,
			["title"],
			fields -> fields.required("title", TextDecoders.nonEmpty(80))
		) {
			case Decoded(value): value;
			case Rejected(issues):
				throw new Error(issues[0].path + ": " + issues[0].message);
		};

		// Authenticate and authorize the current actor here before mutation.
		final cookieStore = await(Headers.mutableCookies());
		cookieStore.set("last-todo", title, {httpOnly: true, path: "/"});
	}
}
```

A Client Component selects that one action through the compile-time ref:

```haxe
package example.client;

import example.actions.TodoActions;
import genes.react.Element;
import nextjs.server.ServerFunction;

@:next.clientComponent
class TodoForm {
	public static function render(_props:{}):Element {
		final save = ServerFunction.ref(TodoActions.save);
		return <form action={save}>
			<input name={"title"} required={true} maxLength={80} />
			<button type={"submit"}>Save</button>
		</form>;
	}
}
```

Although the Haxe source imports `TodoActions` so the compiler can select and
type-check `save`, the emitted Client Component imports only the named generated
action. Its inferred type remains exactly
`(formData: globalThis.FormData) => Promise<void>`.

The adapter published at `app/actions/todos.ts` has this native shape:

```ts
"use server";

import { TodoActions } from "../../src-gen/example/actions/TodoActions";

export async function save(
  ...args: Parameters<typeof TodoActions.save>
): Promise<Awaited<ReturnType<typeof TodoActions.save>>> {
  return TodoActions.save(...args);
}
```

The wrapper is deliberately small, but it is necessary. Without it, the class
method is neither a module-level named export nor a guaranteed actual `async`
function in a correctly placed `"use server"` module.

## Closed action-value contract

The current validator intentionally supports a smaller, proven subset than
every value React may eventually serialize. Arguments and awaited results may
contain:

- `String`, `Bool`, `Int`, and `Float`;
- `Null<T>` and `genes.ts.Undefinable<T>` when `T` is supported;
- `Array<T>` when `T` is supported;
- plain closed records whose fields are all supported;
- string-, number-, or boolean-backed enum abstracts; and
- a top-level `nextjs.raw.server.WebFormData` action argument.

`Void` is also a valid awaited result. `WebFormData` is not accepted as a
nested value or result. Functions, class instances, runtime containers,
runtime Haxe enums, recursive records, `genes.ts.Unknown`, `Any`, and dynamic
values fail before an adapter plan is written. Decode untrusted input into a
closed domain value inside the action; do not widen the action signature to
make external data convenient.

All arguments are required and cannot have defaults. Action owners and methods
are non-generic. Public fields in the owner must each carry exactly one
`@:next.action`; helper fields stay private. Action names use lower-camel Haxe
spelling and become same-named exports.

## Negative: a synchronous or raw action edge

This declaration is rejected even if its body happens to return a Promise:

```haxe
@:next.serverFunctions("actions/unsafe")
class UnsafeActions {
	@:next.action
	public static function save(formData:WebFormData):Promise<Void> {
		return Promise.resolve(null);
	}
}
```

It reports `NXHX-SERVER-FUNCTION-ASYNC-0004`. Next's contract is an actual
async function export, so a Promise-shaped value alone is insufficient.

This Client Component is also the wrong graph edge:

```haxe
final save = TodoActions.save;
return <form action={save}>...</form>;
```

Use `ServerFunction.ref(TodoActions.save)`. The ref accepts only a direct public
static annotated action and imports its generated boundary. It does not infer
that an arbitrary callback is safe to invoke remotely.

When the generated action itself is passed through a Client Component prop,
use `ServerFunction.boundary(TodoActions.save)` and declare the prop as
`nextjs.client.flight.v19.FlightServerFunction<ExactSignature>`.
`boundary(...)` performs the same direct-action validation and generated
adapter import, then retains nominal React Flight provenance. An ordinary
same-shaped callback cannot acquire that type. `ref(...)` remains the
source-compatible direct callable used by form actions and other non-prop
sites.

Other declaration diagnostics are intentionally grouped by responsibility:

| Diagnostic | Rejected contract |
| --- | --- |
| `NXHX-SERVER-FUNCTION-BOUNDARY-0001` | multiple App Router boundary annotations |
| `NXHX-SERVER-FUNCTION-PATH-0002` | unsafe, absolute, extension-bearing, or convention-colliding paths |
| `NXHX-SERVER-FUNCTION-EXPORT-0003` | unsupported, unmarked, duplicated, or incorrectly shaped exports |
| `NXHX-SERVER-FUNCTION-TYPE-0004` | missing, generic, optional, or defaulted signature types |
| `NXHX-SERVER-FUNCTION-ASYNC-0004` | an export that is not an actual async `Promise<Result>` action |
| `NXHX-SERVER-FUNCTION-SERIALIZABLE-0005` | an unsupported argument/result path |
| `NXHX-SERVER-FUNCTION-REF-0006` | a ref that does not select one validated action directly |

## FormData and reserved transport fields

Use `FormDataDecoder.object` for an ordinary request form and
`FormDataDecoder.serverAction` for a form delivered to a Server Function. The
latter ignores names beginning with `$ACTION_`, which Next/React owns for its
action transport. It does not allow other unknown names:

```haxe
FormDataDecoder.serverAction(formData, ["title"], fields ->
	fields.required("title", TextDecoders.nonEmpty(80))
);
```

For `{ $ACTION_ID_...: "", title: "Ship", admin: "true" }`, the reserved
transport entry is hidden, `title` is decoded, and `admin` still produces an
`UnexpectedField` issue at `form.admin`. Application form controls should not
use the reserved `$ACTION_` prefix.

The reserved fields were found by exercising the generated adapter with a real
production browser, not by weakening the generic form decoder. The behavior is
also described in the official
[Next.js Forms guide](https://nextjs.org/docs/app/guides/forms).

## Security boundary

A Server Function is a remotely invokable server entrypoint. Treat every
action as a public HTTP endpoint even when the current UI hides its form or
button. Inside each action, before reading or mutating protected state:

1. validate and decode every client-controlled argument;
2. authenticate the current actor;
3. authorize that actor for the specific resource and operation; and
4. return only data that is safe to cross the Server Function boundary.

The generated adapter performs none of those application decisions. A typed
ref proves the function shape and graph edge; it does not grant authority.
Next's
[Data Security guide](https://nextjs.org/docs/app/guides/data-security)
likewise requires Server Actions to be treated as public endpoints with
authentication and authorization inside the action.

The accepted follow-on design in
[ADR 0005](adr/0005-server-function-security-ergonomics.md) defines the semantic
guarded path for sensitive actions. It requires one typed config containing a
closed decoder, current-request authenticator, authenticated target resolver,
exact-operation authorizer, mutation callback, safe rejection mapper, and
explicit public-result projection. Only the pipeline may construct the scoped
authorization witness passed to the mutation callback.

`nextjs.server.GuardedAction` implements that contract. It improves omission
resistance and call order; it does not prove that an application session,
tenant query, policy callback, transaction, or public projection is
semantically correct.

React's `useActionState` previous-state argument is also client-controlled. Do
not treat it as authenticated server state; decode and compare it with current
server data if it participates in a concurrency decision. Read credentials from
request-local cookies or headers instead of accepting client-supplied identity,
role, tenant, or bearer-token arguments when the server can derive them.

## Guarded sensitive actions

`GuardedAction.run` infers its six application types from one named config:

| Stage | Required type | Responsibility |
| --- | --- | --- |
| `operation` | `Operation` | Nominal value identifying this exact mutation |
| `decode` | `Void -> DecodeResult<Input>` | Convert client-controlled transport into closed input |
| `authenticate` | `Void -> Promise<Authentication<Actor>>` | Validate the current request's server-derived identity |
| `resolve` | `(Actor, Input) -> Promise<TargetResolution<Target>>` | Load the current resource or parent authorization scope after authentication |
| `authorize` | `(Actor, Target, Operation, Input) -> Promise<AuthorizationDecision>` | Decide the exact actor/target/operation/input policy |
| `execute` | `Authorized<Operation, Actor, Target, Input> -> Promise<DomainResult>` | Perform the protected mutation with the pipeline-created witness |
| `expose` | `DomainResult -> PublicResult` | Select only caller-safe result data |
| `reject` | `GuardRejection -> PublicResult` | Map pre-mutation failure to a safe public result |

The order is fixed: decode, authenticate, resolve, authorize, execute, expose.
A malformed decode stops before authentication. An unauthenticated request
stops before target lookup. Missing target and denied policy both map to
`GuardRejection.Unavailable` so the default contract does not reveal resource
existence. The helper constructs `Authorized` only for `Allowed` and never calls
`execute` on a rejected branch.

The application-facing action remains an ordinary native action:

```haxe
@:next.action
@:async
public static function save(formData:WebFormData):Promise<SaveState> {
	return GuardedAction.run({
		operation: SaveTodoOperation.current,
		decode: () -> TodoInputCodecs.saveForm(formData),
		authenticate: TodoSession.currentActor,
		resolve: (actor, input) -> WorkspaceRepository.forRequest(actor, input.workspaceId),
		authorize: TodoPolicy.canSave,
		execute: authorized -> TodoService.save(authorized),
		expose: change -> SaveStates.completed(change.publicVersion),
		reject: SaveStates.fromGuardRejection
	});
}
```

The protected service can require the exact operation witness instead of a
bare client identifier:

```haxe
@:next.serverOnly
class TodoService {
	public static function save(
		authorized:Authorized<SaveTodoOperation, Actor, Workspace, SaveInput>
	):Promise<SaveDomainChange> {
		return TodoRepository.save(authorized.target.id, authorized.input);
	}
}
```

Use a nominal operation class that implements `ActionOperation`, has a private
constructor, and exposes one public value. `String` and other broad markers fail
the generic constraint. A create witness then cannot satisfy a remove or save
service signature. The
`Authorized` Haxe constructor is private, its module carries Next's native
`server-only` poison marker, and the action-value validator rejects the witness
as an argument or result.

Generated genes-ts implementation modules are not a native TypeScript security
API. TypeScript or JavaScript that deliberately imports a generated
implementation constructor, suppresses checks, or manufactures values has left
the supported semantic boundary. Native server code should call a Haxe-owned
server-only service or the public action adapter, never import `Authorized` from
`src-gen`. This is an application-integrity rule, not a cryptographic boundary
against code already executing inside the server process.

### Guarded compile failures and recovery

The guarded config relies on ordinary precise Haxe errors where no custom
diagnostic is needed:

| Failure | Recovery |
| --- | --- |
| `Object requires field authorize` (or another config field) | Supply the missing stage; do not annotate or cast the config |
| `Cannot access private constructor of nextjs.server.Authorized` | Let `GuardedAction.run` create the witness after `Allowed` |
| `Authorized<CreateOperation, ...>` does not unify with `Authorized<RemoveOperation, ...>` | Pass the witness only to the matching operation service and run the matching policy |
| `NXHX-SERVER-FUNCTION-SERIALIZABLE-0005` names `Authorized` | Keep the witness and domain result server-side; return the projected `PublicResult` |
| `NXHX-BOUNDARY-IMPORT-0002` names a guarded helper/service | Move the call into the Server Function or another server-only module and cross through the generated action ref |

There is no `@:authorized`, `@:trustMe`, broad result cast, or suppression that
upgrades a raw action. A raw `@:next.action` remains a correctly typed transport
entry, not a security certification.

Rejected Promises and thrown exceptions from application callbacks retain
ordinary Next behavior. Model expected domain failures inside `DomainResult`
and project them exhaustively. Do not turn unexpected errors or framework
interrupts into caller-visible exception messages.

## Paths, ownership, and evidence

The annotation path is slash-normalized, portable, relative to the discovered
App Router root, and must omit `.ts`. Its leaf cannot be a reserved Next
convention such as `page`, `layout`, or `route`. Publication uses the same
manifest, collision, checksum, transaction, and rollback policy as other
NextJsHx adapters. Existing native files remain application-owned.

Run the focused contract with the pinned Node 20.19.3 toolchain:

```sh
npm run test:server-functions
```

The runner compiles the Haxe graph twice for byte determinism, validates the
adapter plan and 13 exact compile failures (including a broad operation marker,
private witness creation, wrong operation, missing authorizer, witness
serialization, and a raw
client-to-action edge), and executes a classic-JavaScript branch/order probe.
It builds the host CLI, publishes the native action and Client Component
adapters, runs strict TypeScript 6.0.2 with `skipLibCheck: false`, and completes
a Next 16.2.12 Turbopack production build.

A production Chrome session uses the rendered native form, then tampers with
its workspace ID, replays a stale version, submits malformed input, removes the
request session while retaining the rendered form, and sends a body beyond the
fixture's configured 2 KB native Next limit. Only the valid authorized request
mutates the HTTP-only SameSite state. The action response never contains the
domain audit secret, missing and denied targets remain indistinguishable, and
the client graph contains only the precisely typed generated action ref.
