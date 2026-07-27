package codecs;

import js.lib.Promise;
import nextjs.codec.DecodeResult;
import nextjs.codec.RequestDecoder;
import nextjs.raw.server.NextRequest;

class NegativeBoundary {
	static function decode(request:NextRequest):Promise<DecodeResult<String>> {
		return RequestDecoder.json(request, (value, path) -> Decoded(value));
	}

	static function main():Void {}
}
