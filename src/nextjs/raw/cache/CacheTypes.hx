package nextjs.raw.cache;

import haxe.extern.EitherType;

/**
 * Named cache-life profile with discoverable built-ins.
 *
 * Arbitrary strings do not implicitly enter this type. Applications with a
 * profile declared in `next.config` opt in explicitly via `custom(name)`.
 */
@:ts.type("string")
enum abstract CacheLifeProfile(String) to String {
	final Default = "default";
	final Seconds = "seconds";
	final Minutes = "minutes";
	final Hours = "hours";
	final Days = "days";
	final Weeks = "weeks";
	final Max = "max";

	public static inline function custom(name:String):CacheLifeProfile {
		return cast name;
	}
}

/** Custom cache lifetime in seconds. */
typedef CacheLifeConfig = {
	@:ts.optional
	@:optional var stale:Float;
	@:ts.optional
	@:optional var revalidate:Float;
	@:ts.optional
	@:optional var expire:Float;
}

/** Expiry-only profile accepted by `revalidateTag`. */
typedef CacheExpireConfig = {
	@:ts.optional
	@:optional var expire:Float;
}

/** Required tag-revalidation profile. */
typedef RevalidateTagProfile = EitherType<CacheLifeProfile, CacheExpireConfig>;

/** Closed scope selector accepted by `revalidatePath`. */
@:ts.type("'layout' | 'page'")
enum abstract RevalidatePathType(String) to String {
	final Layout = "layout";
	final Page = "page";
}

/** The false-only literal accepted by `unstable_cache` revalidation. */
@:ts.type("false")
enum abstract RevalidationDisabled(Bool) to Bool {
	final Disabled = false;
}

/** Options retained by Next's legacy `unstable_cache` API. */
typedef UnstableCacheOptions = {
	@:ts.optional
	@:optional var revalidate:EitherType<Float, RevalidationDisabled>;
	@:ts.optional
	@:optional var tags:Array<String>;
}
