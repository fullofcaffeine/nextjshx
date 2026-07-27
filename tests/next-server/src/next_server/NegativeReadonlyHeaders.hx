package next_server;

import nextjs.raw.headers.ReadonlyHeaders;

class NegativeReadonlyHeaders {
	static function main():Void {}

	static function mutate(headers:ReadonlyHeaders):Void {
		headers.set("authorization", "unsafe");
	}
}
