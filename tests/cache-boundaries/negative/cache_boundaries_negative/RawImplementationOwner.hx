package cache_boundaries_negative;

import js.lib.Promise;

@:next.cache("invalid/raw-owner")
class RawImplementationOwner {
	@:async
	public static function read(key:String):Promise<String> {
		return key;
	}
}
