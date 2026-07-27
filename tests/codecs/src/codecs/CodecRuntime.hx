package codecs;

import genes.js.Async.await;
import js.lib.Error;
import js.lib.Promise;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.codec.RequestDecoder;
import nextjs.raw.server.WebFormData;
import nextjs.raw.server.WebRequest;
import nextjs.raw.server.WebSearchParams;

/** Node runtime proof kept independent of the Next package resolver. */
class CodecRuntime {
	static function expectDecoded<T>(result:DecodeResult<T>):T {
		return switch result {
			case Decoded(value): value;
			case Rejected(issues): throw new Error("expected decoded value, received " + issues[0].code);
		};
	}

	static function expectRejected<T>(result:DecodeResult<T>, code:DecodeIssueCode, path:String):Void {
		switch result {
			case Decoded(_):
				throw new Error("expected rejected input");
			case Rejected(issues):
				assertEqual(issues[0].code, code, "decode issue code");
				assertEqual(issues[0].path, path, "decode issue path");
		}
	}

	static function assertEqual<T>(actual:T, expected:T, label:String):Void {
		if (actual != expected) {
			throw new Error(label + " mismatch");
		}
	}

	@:async
	static function run():Promise<Void> {
		final validRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":"Ship typed codecs","completed":false}'
		});
		final todo = expectDecoded(await(RequestDecoder.json(validRequest, CodecFixture.decodeTodo)));
		assertEqual(todo.title, "Ship typed codecs", "decoded JSON title");

		final malformed = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: "{not-json"
		});
		expectRejected(await(RequestDecoder.json(malformed, CodecFixture.decodeTodo)), DecodeIssueCode.InvalidJson, "$");

		final wrongType = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":7,"completed":false}'
		});
		expectRejected(await(RequestDecoder.json(wrongType, CodecFixture.decodeTodo)), DecodeIssueCode.ExpectedString, "$.title");

		final extraField = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":"Ship","completed":false,"admin":true}'
		});
		expectRejected(await(RequestDecoder.json(extraField, CodecFixture.decodeTodo)), DecodeIssueCode.UnexpectedField, "$.admin");

		final missingField = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: '{"title":"Ship"}'
		});
		expectRejected(await(RequestDecoder.json(missingField, CodecFixture.decodeTodo)), DecodeIssueCode.MissingField, "$.completed");

		final form = new WebFormData();
		form.append("title", "Ship form decoding");
		form.append("completed", "true");
		final formRequest = new WebRequest("https://example.test/api/todos", {method: "POST", body: form});
		final formTodo = expectDecoded(await(RequestDecoder.form(formRequest, CodecFixture.decodeForm)));
		assertEqual(formTodo.completed, true, "decoded form boolean");

		final malformedFormRequest = new WebRequest("https://example.test/api/todos", {
			method: "POST",
			headers: {"content-type": "application/json"},
			body: "{}"
		});
		expectRejected(await(RequestDecoder.form(malformedFormRequest, CodecFixture.decodeForm)), DecodeIssueCode.InvalidFormData, "form");

		final duplicateForm = new WebFormData();
		duplicateForm.append("title", "First");
		duplicateForm.append("title", "Second");
		duplicateForm.append("completed", "false");
		expectRejected(CodecFixture.decodeForm(duplicateForm), DecodeIssueCode.ExpectedSingleValue, "form.title");

		final fileForm = new WebFormData();
		fileForm.appendEntry("title", new js.html.Blob(["not text"], {type: "text/plain"}), "title.txt");
		fileForm.append("completed", "false");
		expectRejected(CodecFixture.decodeForm(fileForm), DecodeIssueCode.ExpectedText, "form.title");

		final query = expectDecoded(CodecFixture.decodeQuery(new WebSearchParams("page=2&tag=haxe&tag=next")));
		assertEqual(query.tags.join(","), "haxe,next", "decoded repeated query values");
		expectRejected(CodecFixture.decodeQuery(new WebSearchParams("page=2&scope=admin")), DecodeIssueCode.UnexpectedField, "query.scope");
		expectRejected(CodecFixture.decodeQuery(new WebSearchParams("page=2147483648")), DecodeIssueCode.ExpectedInteger, "query.page");
		assertEqual(expectDecoded(CodecFixture.decodeQuery(new WebSearchParams("page=2147483647"))).page, 2147483647, "maximum signed query integer");
		assertEqual(expectDecoded(CodecFixture.decodeQuery(new WebSearchParams("page=-2147483648"))).page, -2147483648, "minimum signed query integer");
	}

	static function main():Void {
		run().then(_ -> TestConsole.log("codecs-runtime: OK: JSON, form, and query boundaries"));
	}
}
