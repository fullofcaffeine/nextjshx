package cache_boundaries_negative;

import js.lib.Promise;

@:next.cachePrivate("invalid/private")
class PrivateCapability {
	@:async
	public static function read(key:String):Promise<String> {
		return key;
	}
}
