package nextjs.raw;

import haxe.extern.Rest;
import nextjs.raw.cache.CacheTypes.CacheLifeConfig;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;
import nextjs.raw.cache.CacheTypes.RevalidatePathType;
import nextjs.raw.cache.CacheTypes.RevalidateTagProfile;
import nextjs.raw.cache.CacheTypes.UnstableCacheOptions;

/** Direct public bindings for `next/cache`. */
extern class Cache {
	@:overload(function(config:CacheLifeConfig):Void {})
	@:jsRequire("next/cache", "cacheLife")
	static function cacheLife(profile:CacheLifeProfile):Void;

	@:jsRequire("next/cache", "cacheTag")
	static function cacheTag(tags:Rest<String>):Void;

	@:jsRequire("next/cache", "refresh")
	static function refresh():Void;

	@:jsRequire("next/cache", "revalidatePath")
	static function revalidatePath(path:String, ?type:RevalidatePathType):Void;

	/** Next 16 requires an explicit profile; the deprecated one-argument form is omitted. */
	@:jsRequire("next/cache", "revalidateTag")
	static function revalidateTag(tag:String, profile:RevalidateTagProfile):Void;

	/**
	 * Legacy generic cache wrapper. The callback type is returned unchanged;
	 * Next's public TypeScript declaration remains the final Promise oracle for
	 * arbitrary callback arities.
	 */
	@:jsRequire("next/cache", "unstable_cache")
	static function unstable_cache<Callback>(callback:Callback, ?keyParts:Array<String>, ?options:UnstableCacheOptions):Callback;

	@:overload(function(config:CacheLifeConfig):Void {})
	@:jsRequire("next/cache", "unstable_cacheLife")
	static function unstable_cacheLife(profile:CacheLifeProfile):Void;

	@:jsRequire("next/cache", "unstable_cacheTag")
	static function unstable_cacheTag(tags:Rest<String>):Void;

	@:jsRequire("next/cache", "unstable_noStore")
	static function unstable_noStore():Void;

	@:jsRequire("next/cache", "updateTag")
	static function updateTag(tag:String):Void;
}
