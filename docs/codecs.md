# Typed request and response codecs

`nextjs.codec.*` is the semantic boundary between untrusted Web request data
and application-owned Haxe domain values. It decodes native JSON, `FormData`,
and URL query values without adding a transport runtime or replacing Next's
`Request`, `FormData`, `URLSearchParams`, or `NextResponse` implementations.

## Why this layer was needed

While implementing the public `next/server` bindings and the production todo
application, two unsafe or awkward host boundaries became concrete:

- Next 16.2.12 inherits `Request.json(): Promise<any>` from the DOM
  declarations. That permits an unchecked body to be claimed as a domain type
  in TypeScript. The raw NextJsHx projection deliberately returns
  `Promise<genes.ts.Unknown>` instead, but application code still needed a
  concise way to turn that value into a useful Haxe type.
- Haxe 4.3.7's DOM `FormData` declarations expose an obsolete file union and
  broad iterator callbacks. Those types made exact text-field validation
  harder than the current Web platform behavior requires.

The production todo slice currently reads trusted fixed-schema persistence;
its next Route Handler increment needs the same domain model to accept JSON,
forms, and queries without introducing ad hoc field access. The codec layer is
therefore reusable infrastructure for that application and for later bridge
research, not a todo-specific wire protocol.

The correction stays on the Haxe side. At runtime, parsing still goes through
the native Web request and responses still go through `NextResponse.json`.

## Boundary model

| Input | Entry point | Successful value | Parse/schema failure path |
| --- | --- | --- | --- |
| JSON request | `RequestDecoder.json` | `DecodeResult<T>` from a `Decoder<T>` | `$`, `$.field`, `$[index]` |
| Form request | `RequestDecoder.form` + `FormDataDecoder.object` | Exact text fields or repeated values | `form`, `form.field`, `form.field[index]` |
| Server Function form | `FormDataDecoder.serverAction` | Exact application fields after reserved `$ACTION_*` transport fields are hidden | `form`, `form.field`, `form.field[index]` |
| URL query | `QueryDecoder.object` | Exact scalar, optional, or repeated values | `query.field`, `query.field[index]` |
| Success response | `ResponseJson.ok` / `withStatus` | `NextResponseBody<ExactBody>` | incompatible bodies fail compilation |
| Decode-error response | `ResponseJson.invalid` | `NextResponseBody<DecodeErrorBody>` | invalid HTTP error status throws before encoding |

`DecodeResult<T>` is exhaustive:

```haxe
enum DecodeResult<T> {
  Decoded(value:T);
  Rejected(issues:Array<DecodeIssue>);
}
```

Each issue has a closed `DecodeIssueCode`, a deterministic path, and a
human-readable message. Exact-object decoders reject unknown fields in sorted
field-name order. Array and repeated-value issues retain input order. A caller
must handle both enum cases; nullable success and thrown validation exceptions
are not used as control flow.

When a successful value is a domain abstract whose runtime storage is broader
than its public type, use the named `Decode.accept` constructor:

```haxe
enum abstract Priority(String) {
  final Critical = "P0";
  final Important = "P1";
}

function priority(value:String):DecodeResult<Priority> {
  return switch value {
    case "P0": Decode.accept(Priority.Critical);
    case "P1": Decode.accept(Priority.Important);
    case _: Decode.reject(DecodeIssueCode.InvalidValue, "priority", "expected P0 or P1");
  };
}
```

The generic boundary preserves the Haxe-proven domain in generated TypeScript,
so the result remains `DecodeResult<"P0" | "P1">` instead of widening to
`DecodeResult<string>`. It performs no assertion or second validation. Use it
only after the branch or decoder has established the value; it does not turn an
untrusted string into a domain value by itself.

## Positive: decode once into a domain value

The only broad value is the explicit `genes.ts.Unknown` parameter at the
external JSON boundary. It is immediately narrowed by reusable decoders:

```haxe
package app.api.todos;

import genes.ts.Unknown;
import nextjs.codec.DecodeResult;
import nextjs.codec.Decoders;

using nextjs.codec.DecodeResultTools;

typedef CreateTodoInput = {
  final title:String;
  final completed:Bool;
}

class CreateTodoCodec {
  public static function decode(
    value:Unknown,
    path:String
  ):DecodeResult<CreateTodoInput> {
    return Decoders.object(value, path, ["completed", "title"], fields ->
      fields.required("title", Decoders.string).flatMap(title ->
        fields.required("completed", Decoders.bool).map(completed ->
          {title: title, completed: completed}
        )
      )
    );
  }
}
```

A Route Handler can then keep parsing, validation, and response types visible:

```haxe
import genes.js.Async.await;
import js.lib.Promise;
import nextjs.codec.DecodeResult;
import nextjs.codec.RequestDecoder;
import nextjs.codec.ResponseJson;
import nextjs.raw.server.NextRequest;
import nextjs.raw.server.NextResponse;

class TodoHandlers {
  @:async
  public static function create(request:NextRequest):Promise<NextResponse> {
    return switch await(RequestDecoder.json(request, CreateTodoCodec.decode)) {
      case Decoded(input):
        ResponseJson.withStatus({
          ok: true,
          title: input.title,
          completed: input.completed
        }, 201);
      case Rejected(issues):
        ResponseJson.invalid(issues, 422);
    };
  }
}
```

The success expression retains the exact body type through
`NextResponseBody<{ok:Bool, title:String, completed:Bool}>`. The macro checks
that the body is JSON-compatible before emitting the ordinary native
`NextResponse.json` call.

## Negative: unchecked input and non-JSON output fail

Without an immediate decoder, this attempted claim is rejected by Haxe:

```haxe
return RequestDecoder.json(request, (value, path) -> Decoded(value));
```

For a declared `DecodeResult<String>`, compilation reports that
`genes.ts.Unknown` is not `String`. This is an executable negative control; the
same unchecked claim against upstream `NextRequest.json()` alone compiles
because the upstream DOM return is `any`.

Response bodies are checked too:

```haxe
ResponseJson.ok(() -> "functions are not JSON");
```

That fails with `Json.value expects a JSON-compatible value`; no response code
is emitted. This prevents a locally precise generic from merely describing an
invalid runtime body.

Malformed transport data becomes a typed result rather than an exception. For
example, invalid JSON yields:

```haxe
Rejected([{
  code: DecodeIssueCode.InvalidJson,
  path: "$",
  message: "request body must contain valid JSON"
}])
```

Calling the form decoder for a body that the native `Request.formData()` parser
cannot parse similarly yields `InvalidFormData` at `form`.

## Forms and query values

Form and query fields use `TextDecoder<T>`. The built-ins cover raw strings,
trimmed non-empty text with a maximum length, signed 32-bit integers, strict
`true`/`false`, and closed string choices.

```haxe
final formResult = FormDataDecoder.object(
  formData,
  ["completed", "title"],
  fields -> fields.required("title", TextDecoders.nonEmpty(80)).flatMap(title ->
    fields.required("completed", TextDecoders.bool).map(completed ->
      {title: title, completed: completed}
    )
  )
);

final queryResult = QueryDecoder.object(
  request.nextUrl.searchParams,
  ["page", "tag"],
  fields -> fields.required("page", TextDecoders.int32).flatMap(page ->
    fields.many("tag", TextDecoders.nonEmpty(20)).map(tags ->
      {page: page, tags: tags}
    )
  )
);
```

`required` and `optional` reject duplicate scalar values. `many` validates
every occurrence. Form files are rejected by text fields with `ExpectedText`;
file upload schemas should use a future explicit file decoder rather than
silently accepting a Blob as text. Fields absent from the supplied closed
allowlist are rejected before the domain builder runs.

React includes framework-owned `$ACTION_*` fields in `FormData` submitted to a
Server Function. Use `FormDataDecoder.serverAction` at that boundary: it ignores
only names with the reserved `$ACTION_` prefix while continuing to reject every
unexpected application field. For example, `$ACTION_ID_fixture` is hidden but
an unlisted `admin` field still yields `UnexpectedField` at `form.admin`.
Ordinary request forms should continue to use `FormDataDecoder.object`, and
application controls should not use the reserved prefix. The complete action
boundary and production-form evidence are documented in the
[Server Function reference](server-functions.md).

## Response guarantees and limits

`ResponseJson.ok(body)` uses status 200. `withStatus(body, status)` forwards an
explicit status to native Next. `invalid(issues, status)` accepts only 400–599
and encodes the stable shape `{ok: false, issues: [...]}`. Given the same typed
body and ordered issues, encoding follows native `JSON.stringify` determinism;
the helper does not sort application object keys or add a second serializer.

The codecs intentionally do not:

- infer a domain schema from a Haxe typedef;
- validate arbitrary internal values that never cross a wire boundary;
- parse file uploads, dates, IDs, or application-specific enums implicitly;
- canonicalize success-response object keys; or
- replace Next's request, response, routing, or production-build validation.

Build domain decoders from the small primitives, and add named application
decoders when a value has semantics beyond its wire representation.

## Evidence

```sh
npm run test:codecs
```

The gate compiles the semantic layer through genes-ts, runs strict TypeScript
6.0.2 with `skipLibCheck: false`, executes native JSON/form/query behavior on
Node, checks reserved Server Function transport fields while retaining
closed-schema rejection for other form names, checks eight malformed-input
controls plus signed 32-bit endpoints, and requires two focused Haxe compile
failures. It scans emitted repository-owned
modules for TypeScript
`any`, unchecked compiler casts, suppression comments, private Next imports,
and machine-local paths. The test deletes generated output on both success and
failure. The stable production fixture also uses `ResponseJson.ok` in its Haxe
POST handler, so the root Next build and HTTP smoke prove that the checked
helper still emits the native runtime response path.
