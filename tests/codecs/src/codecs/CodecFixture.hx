package codecs;

import genes.js.Async.await;
import genes.ts.Unknown;
import js.lib.Error;
import js.lib.Promise;
import nextjs.codec.DecodeIssue;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.codec.Decoders;
import nextjs.codec.FormDataDecoder;
import nextjs.codec.QueryDecoder;
import nextjs.codec.RequestDecoder;
import nextjs.codec.ResponseJson;
import nextjs.codec.TextDecoders;
import nextjs.raw.server.WebRequest;
import nextjs.raw.server.WebFormData;
import nextjs.raw.server.WebSearchParams;

using nextjs.codec.DecodeResultTools;

typedef TodoInput = {
	final title:String;
	final completed:Bool;
}

typedef FilterInput = {
	final page:Int;
	final tags:Array<String>;
}

enum abstract EvidencePriority(String) {
	final Critical = "P0";
	final Important = "P1";

	public inline function value():String {
		return this;
	}
}

/** Runtime and strict-TypeScript evidence for the semantic codec boundary. */
class CodecFixture {
	public static function decodePriority(value:String):DecodeResult<EvidencePriority> {
		return switch value {
			case "P0": nextjs.codec.Decode.accept(EvidencePriority.Critical);
			case "P1": nextjs.codec.Decode.accept(EvidencePriority.Important);
			case _: nextjs.codec.Decode.reject(DecodeIssueCode.InvalidValue, "priority", "expected P0 or P1");
		};
	}

	public static function decodeTodo(value:Unknown, path:String):DecodeResult<TodoInput> {
		return Decoders.object(value, path, ["completed", "title"], fields -> {
			return fields.required("title", Decoders.string).flatMap(title -> {
				return fields.required("completed", Decoders.bool).map(completed -> {
					return {title: title, completed: completed};
				});
			});
		});
	}

	public static function decodeForm(data:WebFormData):DecodeResult<TodoInput> {
		return FormDataDecoder.object(data, ["completed", "title"], fields -> {
			return fields.required("title", TextDecoders.nonEmpty(80)).flatMap(title -> {
				return fields.required("completed", TextDecoders.bool).map(completed -> {
					return {title: title, completed: completed};
				});
			});
		});
	}

	public static function decodeServerActionForm(data:WebFormData):DecodeResult<String> {
		return FormDataDecoder.serverAction(data, ["title"], fields -> fields.required("title", TextDecoders.nonEmpty(80)));
	}

	public static function decodeQuery(params:WebSearchParams):DecodeResult<FilterInput> {
		return QueryDecoder.object(params, ["page", "tag"], fields -> {
			return fields.required("page", TextDecoders.int32).flatMap(page -> {
				return fields.many("tag", TextDecoders.nonEmpty(20)).map(tags -> {
					return {page: page, tags: tags};
				});
			});
		});
	}

	static function expectDecoded<T>(result:DecodeResult<T>):T {
		return switch result {
			case Decoded(value): value;
			case Rejected(issues): throw new Error("expected decoded value, received " + issues[0].code + " at " + issues[0].path);
		};
	}

	static function expectRejected<T>(result:DecodeResult<T>, code:DecodeIssueCode, path:String):Array<DecodeIssue> {
		return switch result {
			case Decoded(_): throw new Error("expected rejected input");
			case Rejected(issues):
				assertEqual(issues[0].code, code, "decode issue code");
				assertEqual(issues[0].path, path, "decode issue path");
				issues;
		};
	}

	static function assertEqual<T>(actual:T, expected:T, label:String):Void {
		if (actual != expected) {
			throw new Error(label + " mismatch");
		}
	}

	@:async
	static function run():Promise<Void> {
		assertEqual(expectDecoded(decodePriority("P1")).value(), "P1", "closed decoded domain");
		final validRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":"Ship typed codecs","completed":false}'
		});
		final todo = expectDecoded(await(RequestDecoder.json(validRequest, decodeTodo)));
		assertEqual(todo.title, "Ship typed codecs", "decoded JSON title");
		assertEqual(todo.completed, false, "decoded JSON boolean");

		final malformedRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: "{not-json"
		});
		expectRejected(await(RequestDecoder.json(malformedRequest, decodeTodo)), DecodeIssueCode.InvalidJson, "$");

		final wrongTypeRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":7,"completed":false}'
		});
		final wrongTypeIssues = expectRejected(await(RequestDecoder.json(wrongTypeRequest, decodeTodo)), DecodeIssueCode.ExpectedString, "$.title");

		final extraFieldRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":"Ship","completed":false,"admin":true}'
		});
		expectRejected(await(RequestDecoder.json(extraFieldRequest, decodeTodo)), DecodeIssueCode.UnexpectedField, "$.admin");

		final missingFieldRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":"Ship"}'
		});
		expectRejected(await(RequestDecoder.json(missingFieldRequest, decodeTodo)), DecodeIssueCode.MissingField, "$.completed");

		final form = new WebFormData();
		form.append("title", "Ship form decoding");
		form.append("completed", "true");
		final formRequest = new WebRequest("https://example.test/api/todos", {method: "POST", body: form});
		final formTodo = expectDecoded(await(RequestDecoder.form(formRequest, decodeForm)));
		assertEqual(formTodo.title, "Ship form decoding", "decoded form title");
		assertEqual(formTodo.completed, true, "decoded form boolean");

		final actionForm = new WebFormData();
		actionForm.append("$ACTION_ID_fixture", "");
		actionForm.append("title", "Ship native actions");
		assertEqual(expectDecoded(decodeServerActionForm(actionForm)), "Ship native actions", "decoded action form");
		actionForm.append("admin", "true");
		expectRejected(decodeServerActionForm(actionForm), DecodeIssueCode.UnexpectedField, "form.admin");

		final malformedFormRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: "{}"
		});
		expectRejected(await(RequestDecoder.form(malformedFormRequest, decodeForm)), DecodeIssueCode.InvalidFormData, "form");

		final duplicateForm = new WebFormData();
		duplicateForm.append("title", "First");
		duplicateForm.append("title", "Second");
		duplicateForm.append("completed", "false");
		expectRejected(decodeForm(duplicateForm), DecodeIssueCode.ExpectedSingleValue, "form.title");

		final query = expectDecoded(decodeQuery(new WebSearchParams("page=2&tag=haxe&tag=next")));
		assertEqual(query.page, 2, "decoded query integer");
		assertEqual(query.tags.join(","), "haxe,next", "decoded repeated query values");
		expectRejected(decodeQuery(new WebSearchParams("page=2&scope=admin")), DecodeIssueCode.UnexpectedField, "query.scope");
		expectRejected(decodeQuery(new WebSearchParams("page=2147483648")), DecodeIssueCode.ExpectedInteger, "query.page");
		assertEqual(expectDecoded(decodeQuery(new WebSearchParams("page=2147483647"))).page, 2147483647, "maximum signed query integer");
		assertEqual(expectDecoded(decodeQuery(new WebSearchParams("page=-2147483648"))).page, -2147483648, "minimum signed query integer");

		final response = ResponseJson.ok({ok: true, title: todo.title, completed: todo.completed});
		final responseBody = await(response.json());
		assertEqual(response.status, 200, "typed success response status");
		assertEqual(responseBody.title, todo.title, "typed success response body");

		final createdResponse = ResponseJson.withStatus({ok: true, title: todo.title}, 201);
		final createdBody = await(createdResponse.json());
		assertEqual(createdResponse.status, 201, "typed created response status");
		assertEqual(createdBody.title, todo.title, "typed created response body");

		final invalidResponse = ResponseJson.invalid(wrongTypeIssues, 422);
		final invalidBody = await(invalidResponse.json());
		assertEqual(invalidResponse.status, 422, "typed failure response status");
		assertEqual(invalidBody.issues[0].code, "expected_string", "typed failure response body");
	}

	static function main():Void {
		run().then(_ -> TestConsole.log("codecs-runtime: OK: JSON, form, query, and typed response boundaries"));
	}
}
