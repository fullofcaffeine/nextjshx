# ADR 0005: Non-deceptive Server Function security ergonomics

- Status: Accepted
- Date: 2026-07-18
- Decision owners: project owner and NextJsHx maintainers
- Related Beads: `nxhx-f34.5.8.4`, `nxhx-f34.5.8.5`
- Related PRD sections: 12.4, 18.3, 19.1-19.3, 23

## Context

A Next.js Server Function is a remotely invokable server entrypoint. Its
arguments are controlled by the client, and its return value is serialized back
to that client. Rendering a form only for signed-in users, hiding a button, or
holding a generated function reference does not authorize the corresponding
POST.

NextJsHx already proves useful transport facts: an action is an actual async
function, its argument and result shapes belong to a conservative serialization
subset, its adapter begins with `"use server"`, and a client imports the generated
action boundary instead of the raw server implementation. Closed
`FormDataDecoder.serverAction` decoding also rejects unexpected application
fields while ignoring only React's reserved `$ACTION_*` transport fields.

Those facts do not establish who made the current request, whether a session is
fresh, whether the actor belongs to the selected tenant, whether the actor may
perform this operation on this resource, or whether an otherwise serializable
result contains data the caller must not see.

### Why this decision was needed

While developing the NextJsHx todo application, the first realistic Server
Functions could decode form data and mutate the deterministic store, but the
fixture deliberately had no identity model. The action declaration therefore
looked substantially safer than the application policy it could actually prove.
The same exploration exposed two common failure modes that ordinary shape
checking cannot catch:

- an authenticated actor can submit another tenant's resource identifier
  directly to the action; and
- a closed, serializable database record can still expose an owner identifier,
  audit token, billing state, or other field that the UI never needed.

Documentation-only reminders help reviewers but do not prevent a future action
from accidentally decoding and mutating while omitting one of the request-local
checks. Conversely, metadata such as `@:authorized` would be worse than a
reminder: it would convert an unverified assertion into a security-sounding
compiler claim.

The semantic layer needs a path that is easier to complete correctly, makes
omitted stages visible to Haxe, and remains honest about the facts only the
application can decide.

### Native Next and React protections remain in force

The guarded Haxe flow is code inside an ordinary native Server Function. It
does not replace or reimplement these framework behaviors:

| Native behavior | What it contributes | What it does not prove |
| --- | --- | --- |
| Direct POST reachability | Every exported action must be reviewed as a public server endpoint, even if no current UI exposes it | identity, permission, or safe input |
| POST-only invocation | Narrows the accepted HTTP method | caller trust or authorization |
| Origin compared with `Host` or `X-Forwarded-Host`; extra origins configured with `serverActions.allowedOrigins` | Framework CSRF defense for same-origin deployments and reviewed proxies | actor identity, tenant membership, or resource policy |
| `serverActions.bodySizeLimit`, with a 1 MB default raw request-body limit | Bounds the accepted transport size, including multipart overhead | field schema, value validity, or business limits |
| Encrypted, non-deterministic action identifiers plus dead-code elimination and periodic regeneration | Reduces accidental action discovery and removes unused actions | authentication or authorization; a reachable identifier remains callable |

The relevant native contracts are documented by Next in
[`serverActions` configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions),
the [`use server` reference](https://nextjs.org/docs/app/api-reference/directives/use-server),
and the [data-security guide](https://nextjs.org/docs/app/guides/data-security).
React independently states that
[every Server Function argument is client-controlled](https://react.dev/reference/rsc/use-server#security-considerations).

### Mechanically provable and application-owned facts

The security vocabulary is deliberately split:

| Mechanically provable when the guarded helper is used | Requires runtime application evidence |
| --- | --- |
| the transport value enters a closed decoder before a mutation callback | the decoder expresses every domain invariant |
| current-request authentication callback is invoked for this pipeline run | the callback reads the intended request-local cookies or headers and validates a fresh session |
| target resolution occurs only after authentication | the query is tenant-scoped, current, and resistant to confused-deputy or enumeration mistakes |
| authorization callback is invoked with the decoded input, resolved target, actor, and exact operation marker | the policy implements the intended ownership, role, tenancy, and business rules |
| the mutation callback is not invoked after malformed, unauthenticated, missing-target, or denied outcomes | the mutation is atomic, race-safe, idempotent where needed, and uses no alternate unguarded path |
| only the guarded pipeline can construct its supported `Authorized` witness | application code has not deliberately subverted Haxe with unsafe access metadata, `untyped`, or an unchecked cast |
| the mutation result passes through an explicit projection before becoming the public result | the projection omits every secret and returns only data needed by the caller |
| the final public type is in the conservative Server Function serialization subset | each serializable field is appropriate for this actor |

This is omission resistance, not a proof of policy correctness. An application
can still implement an authenticator that always returns a fixed actor, a
resolver that ignores tenancy, an authorizer that always allows, or a projector
that copies a secret. No Haxe macro can infer those facts from arbitrary
business logic.

### Compared designs

| Design | Useful property | Failure | Decision |
| --- | --- | --- | --- |
| Documentation beside every action | No runtime or compiler machinery | Security stages remain easy to omit and review inconsistently | Retained as explanation, rejected as the only guard |
| `@:authenticated` or `@:authorized` metadata | Visually concise | An annotation is a claim; it cannot execute or validate application policy | Rejected |
| Search action bodies for calls named `decode`, `authenticate`, or `authorize` | Can catch a few local omissions | Aliases, helpers, control flow, native TypeScript, and dishonest stubs make the result unsound and easy to silence | Rejected |
| Generate a security skeleton | Good onboarding and named stages | Generated code can be edited or bypassed; it provides no continuing type invariant | Retained as future scaffolding, insufficient alone |
| Typed guarded pipeline with application callbacks and a private witness | Enforces stage presence, order, failure short-circuiting, exact context flow, and explicit output projection | Cannot prove the callbacks' application semantics | Selected |
| Replace actions with custom RPC middleware | Could centralize policy | Changes Next runtime semantics and duplicates its transport | Rejected |

## Decision

### Use an explicitly guarded semantic path

NextJsHx will add `nextjs.server.GuardedAction` as the security-oriented
semantic path for sensitive Server Functions. The name is intentionally not
`SecureAction`: the helper guards a required control-flow shape but cannot make
an application policy correct.

The existing `@:next.action` declaration and `ServerFunction.ref` remain the
faithful native transport surface. They do not acquire an authenticated,
authorized, protected, or secure classification. Public/login actions and
applications with their own rigorously reviewed policy layer may continue to
use that surface directly.

The selected contract is equivalent to the following Haxe shape; the
implementation Bead may refine names without weakening these invariants:

```haxe
typedef GuardedActionSpec<Operation:ActionOperation, Input, Actor, Target, DomainResult, PublicResult> = {
	final operation:Operation;
	final decode:Void->DecodeResult<Input>;
	final authenticate:Void->Promise<Authentication<Actor>>;
	final resolve:(Actor, Input)->Promise<TargetResolution<Target>>;
	final authorize:(Actor, Target, Operation, Input)->Promise<AuthorizationDecision>;
	final execute:Authorized<Operation, Actor, Target, Input>->Promise<DomainResult>;
	final expose:DomainResult->PublicResult;
	final reject:GuardRejection->PublicResult;
}
```

The result enums are closed and internal to the flow:

```haxe
enum Authentication<Actor> {
	Authenticated(actor:Actor);
	Unauthenticated;
}

enum TargetResolution<Target> {
	Resolved(target:Target);
	Missing;
}

enum AuthorizationDecision {
	Allowed;
	Denied;
}

enum GuardRejection {
	Malformed(issues:Array<DecodeIssue>);
	Unauthenticated;
	Unavailable;
}
```

`Missing` and `Denied` both become the coarse public `Unavailable` rejection.
That default prevents the helper from revealing resource existence. An
application that truly needs a distinguishable response must implement and
review that distinction outside the default helper rather than enabling a
global switch.

`GuardedAction.run(spec)` performs exactly this sequence on every invocation:

1. call `decode`; reject `Malformed` on failure;
2. call `authenticate`; reject `Unauthenticated` on failure;
3. call `resolve(actor, input)`; reject `Unavailable` when absent;
4. call `authorize(actor, target, operation, input)`; reject `Unavailable` when
   denied;
5. construct an immutable `Authorized<Operation, Actor, Target, Input>` only
   for the allowed branch;
6. call `execute(authorized)`; and
7. call `expose(domainResult)` to produce the Server Function's public result.

The helper returns `Promise<PublicResult>`. It does not add a request envelope,
endpoint, registry, middleware, cookie format, session store, policy engine, or
exception protocol.

### The witness is scoped and cannot be self-asserted

`Authorized<Operation, Actor, Target, Input>` is an immutable context with
read-only `actor`, `target`, `operation`, and `input` accessors. Its constructor
is private and accessible only to the guarded pipeline. There is no public
`allow`, `fromBool`, `trusted`, deserializer, optional witness, or annotation
that manufactures it.

The application supplies an operation value with a precise Haxe type. Sensitive
service methods may require the corresponding witness rather than accepting a
bare identifier:

```haxe
class ToggleTodoOperation implements ActionOperation {
	public static final current = new ToggleTodoOperation();
	private function new() {}
}

class TodoService {
	public static function toggle(
		authorized:Authorized<ToggleTodoOperation, Actor, Todo, TodoId>
	):Promise<TodoChange> {
		return TodoRepository.toggle(authorized.target.id);
	}
}
```

Using a nominal operation marker prevents a witness inferred for a create or
delete policy from satisfying the toggle service signature. The witness also
carries the resolved target, not merely the client-supplied identifier. It may
be used by multiple operations inside the one authorized mutation callback,
but it is not serializable and must never cross a Server Function or
Server-to-Client boundary.

Haxe's type system, like TypeScript's, can be deliberately subverted by unsafe
casts or private-access metadata. NextJsHx does not present those constructs as
an escape hatch. Repository-owned code and generated public APIs reject broad
casts, `untyped`, and authority-sounding suppression metadata. The security
claim is limited to the supported typed API used without deliberate compiler
subversion.

Haxe privacy is the application-facing capability boundary. genes-ts preserves
the runtime class needed by generated modules but does not turn that emitted
implementation constructor into a cryptographic JavaScript secret. The module
is poisoned with Next's native `server-only` marker, and native application code
must not import `Authorized` from generated `src-gen` output. Deliberately
constructing it from an implementation module is equivalent to using an unsafe
cast: it leaves the supported semantic contract. Code already executing inside
the application server is part of the trusted computing base, so this design
does not claim to defend the application from its own hostile server code.

### Authentication is request-local and server-derived

The authenticator is a zero-argument callback invoked during each action call.
It should read a server-side session from `cookies()` or `headers()` and then
validate it against the application's session store. Client arguments must not
carry an actor, role, tenant membership, or bearer token when that authority can
be derived from the current request.

The helper can prove that it invoked the callback. It cannot prove that the
callback avoided a global cache, accepted the correct cookie, checked expiry or
revocation, or used the current deployment's trusted proxy configuration.

The `previous` value passed by React's `useActionState` is client-controlled as
well. It is suitable for rendering prior public form state, not as authenticated
server state. If it participates in concurrency or authorization, it must be
decoded and compared with authoritative server data like any other input.

### Resolution is authenticated and target-specific

`resolve` receives the authenticated actor and decoded input. A resource
mutation should load the exact current record through a tenant-scoped query.
For a create operation, the target is the parent authorization scope, such as a
workspace, organization, account, or cart; it is not replaced with a fake
resource and is not accepted as a client-supplied object.

Resolving after authentication reduces accidental resource enumeration and
makes tenant scoping available to the query. The subsequent authorizer still
must check the exact operation on the resolved target. Resolution alone is not
authorization.

### Projection is mandatory but does not certify secrecy

`execute` returns an application-only `DomainResult`. The pipeline cannot
return that value directly; an `expose` function must create `PublicResult`.
This forces the transport decision to be visible even when both types happen
to contain only serializable primitives.

The Server Function macro then validates `PublicResult` against the conservative
serialization contract. It cannot infer that a field named `token`, `email`, or
`ownerId` is sensitive in this application. Review, tests, and data-access
design remain responsible for the projection's contents.

Rejected Promises and thrown exceptions are not silently converted into public
messages. They retain ordinary Next behavior, including framework interrupts
such as redirects. An application that models expected mutation failures as
data should include them in `DomainResult` and exhaustively project them to a
safe public result.

### Example one: create inside an authorized workspace

The current native API permits this concise action, but the compiler cannot see
that workspace membership was omitted or that the returned record is too wide:

```haxe
@:next.action
@:async
public static function create(_previous:CreateState, formData:WebFormData):Promise<CreatedTodoRecord> {
	return switch TodoInputCodecs.draftForm(formData) {
		case Decoded(draft): TodoRepository.create(draft.workspaceId, draft);
		case Rejected(issues): throw new Error(issues[0].message);
	};
}
```

`CreatedTodoRecord` may be structurally serializable while still containing
`internalOwnerId` and `auditToken`. A caller can also submit a workspace ID from
another tenant. Without application checks, the generated action adapter
faithfully exposes both defects.

The selected guarded shape makes every stage explicit and binds create
authorization to the resolved workspace:

```haxe
@:next.action
@:async
public static function create(_previous:CreateState, formData:WebFormData):Promise<CreateState> {
	return GuardedAction.run({
		operation: CreateTodoOperation.current,
		decode: () -> TodoInputCodecs.draftForm(formData),
		authenticate: TodoSession.currentActor,
		resolve: (actor, draft) -> WorkspaceRepository.forActor(actor, draft.workspaceId),
		authorize: TodoPolicy.canCreate,
		execute: authorized -> TodoService.create(authorized),
		expose: created -> CreateStates.completed(created.publicId, created.title),
		reject: CreateStates.fromGuardRejection
	});
}
```

Behavior is deterministic at the structural boundary:

| Case | Pipeline behavior |
| --- | --- |
| valid input, authenticated member, allowed create | resolves that member's workspace, invokes the verifier, executes once, and exposes only `publicId` and `title` |
| malformed form or unexpected field | returns the application's sanitized malformed state; session lookup and mutation are not called |
| no valid session | returns the unauthenticated state; workspace resolution and mutation are not called |
| actor is not a workspace member or policy denies create | returns unavailable; mutation is not called |
| repository returns a record containing internal fields | only the explicit `CreateStates.completed` projection crosses the boundary |

The helper cannot prove that `WorkspaceRepository.forActor` or
`TodoPolicy.canCreate` is correct, but it prevents accidentally omitting their
slots or calling the configured mutation on their rejected branches.

### Example two: toggle the exact current todo

This direct version authenticates a user but remains vulnerable to an
insecure-direct-object-reference mistake because it mutates by the submitted ID
without loading and authorizing the current todo:

```haxe
final actor = await(TodoSession.requireActor());
final id = TodoInputCodecs.requireId(formData);
return TodoRepository.toggle(id);
```

The guarded action resolves the target after authentication and invokes a
toggle-specific policy before the service receives a capability:

```haxe
@:next.action
@:async
public static function toggle(_previous:MutationState, formData:WebFormData):Promise<MutationState> {
	return GuardedAction.run({
		operation: ToggleTodoOperation.current,
		decode: () -> TodoInputCodecs.idForm(formData),
		authenticate: TodoSession.currentActor,
		resolve: (actor, id) -> TodoRepository.visibleTo(actor, id),
		authorize: TodoPolicy.canToggle,
		execute: authorized -> TodoService.toggle(authorized),
		expose: change -> MutationStates.completed(change.version),
		reject: MutationStates.fromGuardRejection
	});
}
```

| Case | Pipeline behavior |
| --- | --- |
| owner submits a valid current todo ID | verifier receives that actor, resolved todo, toggle marker, and decoded ID; service executes once |
| malformed or unknown ID syntax | returns malformed; authentication and repository mutation are not called |
| unauthenticated direct POST | returns unauthenticated; target resolution and mutation are not called |
| authenticated actor submits another tenant's valid ID | tenant-scoped resolution returns missing or policy denies; both become unavailable and mutation is not called |
| domain change contains audit actor, previous value, and internal revision | projection returns only the public status/version fields selected for the UI |

This example is also the negative control for UI-only security: removing the
toggle button for non-owners changes none of the direct-POST behavior.

### Static analysis is deliberately bounded

NextJsHx will not claim that a raw `@:next.action` is safe after finding a call
whose name resembles an authenticator or after seeing a broad metadata marker.
Such analysis misses helper aliases, conditional control flow, native
TypeScript, callbacks that always allow, mutations before the check, stale
resources, and result fields whose sensitivity is domain-specific.

Static checks may enforce only reduced, sound contracts:

- `GuardedActionSpec` contains every required callback with closed types;
- the private witness is constructed only on the allowed branch;
- the configured `execute` callback is unreachable from every rejected branch;
- the witness and internal rejection enums are not valid transport values;
- the action's final `PublicResult` remains serializable; and
- direct application construction of the witness fails at the Haxe source
  position.

There is no `@:trustMe`, `@:authorized`, broad result cast, or diagnostic
suppression that upgrades a raw action into this contract. Deliberately unsafe
Haxe remains outside the supported semantic surface and does not receive a
security claim.

### Evidence required by the implementation

The implementation Bead must add executable evidence for both create-scope and
existing-resource mutations:

- positive Haxe fixtures for every pipeline branch and exact inferred types;
- negative Haxe fixtures for direct witness construction, wrong operation
  witness, missing callbacks, broad transport values, and witness
  serialization;
- runtime call-order/count assertions proving decode, authentication,
  resolution, authorization, mutation, projection, and short-circuiting;
- malformed, unauthenticated, unauthorized, missing-target, mutation failure,
  and overexposed-domain-result controls;
- deterministic genes-ts output, strict TypeScript with library checking, and
  a pinned Next production build through the native action adapter; and
- direct browser POST evidence showing that hiding a UI control does not alter
  the server guard and that only the projected public result reaches the
  client.

Tests must use application callbacks that actually inspect an actor and target;
an `Allowed` constant alone is not evidence of the intended integration.

## Consequences

Positive consequences:

- sensitive actions gain a discoverable, Haxe-inferred happy path with named
  security stages and source-positioned omissions;
- the mutation callback cannot run through the supported helper until decode,
  authentication, resolution, and exact-operation authorization all succeed;
- service methods can require an operation-scoped witness, making accidental
  unguarded calls harder;
- resource absence and policy denial share a non-enumerating default response;
- public output requires an explicit projection even when the domain record is
  structurally serializable; and
- Next and React continue to own transport, action discovery, origin checks,
  body limits, framework interrupts, compilation, and deployment.

Costs and limits:

- a guarded action has more explicit application code than a raw action;
- applications must define their actor, target, operation markers, session
  lookup, policy callbacks, safe rejection state, and public projection;
- the helper guarantees callback presence and order, not callback correctness,
  session freshness, tenant scoping, transaction safety, or result secrecy;
- a deliberately unsafe cast can subvert any Haxe type invariant and therefore
  voids the supported security claim;
- existing actions do not become guarded automatically and require deliberate
  migration; and
- expected domain failures need a closed application model, while unexpected
  exceptions retain native Next behavior.

No Oracle escalation is required for this decision. The trust boundary reduces
cleanly to an ordinary typed pipeline with a private constructor, a pattern
already exercised by repository codecs. The implementation still requires the
negative compiler and runtime evidence listed above before the API can be
documented as available.

## Rejected alternatives

### Keep security entirely documentation-only

This preserves maximum freedom but leaves every action reviewer responsible for
spotting the same missing stages. Documentation remains necessary for callback
semantics, but it cannot provide omission resistance or a service capability.

### Add authority-sounding action metadata

`@:authenticated`, `@:authorized`, `@:protected`, or `@:secure` can state an
intention but cannot establish a current actor or evaluate a resource policy.
Using them as certification would be deceptive. The selected helper requires
executable callbacks and creates its witness only after their success.

### Statically recognize authentication and authorization calls

Searching a typed or untyped action body for selected functions is not a sound
proof across aliases, higher-order functions, branches, native modules, and
application-specific policy. It can also miss mutations that occur before the
recognized call. NextJsHx limits static enforcement to the explicit pipeline's
closed control-flow contract.

### Expose a public Authorized constructor or boolean factory

A public `Authorized.fromBool(isAllowed)` would detach the capability from the
current actor, resolved target, operation, and verifier invocation. It would
also encourage validation in a different request or at a stale time. Only the
pipeline constructs the witness after invoking all current callbacks.

### Treat target resolution as authorization

Finding a record proves only that it exists under the resolver's query. It does
not prove permission for create, toggle, delete, publish, refund, or another
operation. The selected flow keeps resolution and exact-operation policy as
separate mandatory stages.

### Return the domain result when it is serializable

Serialization safety is not disclosure safety. A database record made only of
strings and numbers can still contain secrets or cross-tenant data. The public
projection remains mandatory and visible.

### Reimplement Server Functions behind a custom RPC or policy runtime

That would create a parallel request model, weaken native ecosystem
compatibility, and duplicate Next's origin, body, action-ID, build, and
deployment behavior. The selected helper executes entirely inside the normal
Server Function implementation.
