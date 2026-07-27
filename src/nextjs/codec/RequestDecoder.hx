package nextjs.codec;

import genes.js.Async.await;
import js.lib.Error;
import js.lib.Promise;
import nextjs.raw.server.WebFormData;
import nextjs.raw.server.WebRequest;

/** Request-body helpers that turn parse failures into typed decode results. */
class RequestDecoder {
	@:async
	public static function json<T>(request:WebRequest, decoder:Decoder<T>):Promise<DecodeResult<T>> {
		try {
			return decoder(await(request.json()), "$");
		} catch (error:Error) {
			return Decode.reject(DecodeIssueCode.InvalidJson, "$", "request body must contain valid JSON");
		}
	}

	@:async
	public static function form<T>(request:WebRequest, decoder:WebFormData->DecodeResult<T>):Promise<DecodeResult<T>> {
		try {
			return decoder(await(request.formData()));
		} catch (error:Error) {
			return Decode.reject(DecodeIssueCode.InvalidFormData, "form", "request body must contain valid form data");
		}
	}
}
