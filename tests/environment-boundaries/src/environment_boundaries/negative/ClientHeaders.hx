package environment_boundaries.negative;

import js.lib.Promise;
import nextjs.raw.Headers;
import nextjs.raw.headers.ReadonlyHeaders;

/** Must fail before a client-only Haxe module reaches Next. */
@:next.clientOnly
class ClientHeaders {
	public static function read():Promise<ReadonlyHeaders> {
		return Headers.headers();
	}
}
