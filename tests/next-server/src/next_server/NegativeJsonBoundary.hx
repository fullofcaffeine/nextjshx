package next_server;

import js.lib.Promise;
import nextjs.raw.server.NextRequest;

class NegativeJsonBoundary {
	static function main():Void {}

	static function decode(request:NextRequest):Promise<String> {
		return request.json();
	}
}
