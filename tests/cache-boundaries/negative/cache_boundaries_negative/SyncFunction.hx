package cache_boundaries_negative;

import js.lib.Promise;

@:next.cache("invalid/sync")
class SyncFunction {
	public static function read(key:String):Promise<String> {
		return Promise.resolve(key);
	}
}
