package codecs;

import nextjs.codec.ResponseJson;

class NegativeResponse {
	static function main():Void {
		ResponseJson.ok(() -> "functions are not JSON");
	}
}
