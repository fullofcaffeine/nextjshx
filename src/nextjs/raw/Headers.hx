package nextjs.raw;

import js.lib.Promise;
import nextjs.raw.headers.CookieTypes.MutableRequestCookies;
import nextjs.raw.headers.CookieTypes.ReadonlyRequestCookies;
import nextjs.raw.headers.DraftMode;
import nextjs.raw.headers.ReadonlyHeaders;

/** Direct public bindings for the async `next/headers` request APIs. */
extern class Headers {
	/** Safe default: reads cookies without exposing context-restricted writes. */
	@:jsRequire("next/headers", "cookies")
	static function cookies():Promise<ReadonlyRequestCookies>;

	/**
	 * Explicit write-capable view for Server Actions and Route Handlers.
	 *
	 * This imports the same public Next function; the separate Haxe name makes
	 * the caller's mutation intent visible without adding a runtime wrapper.
	 */
	@:jsRequire("next/headers", "cookies")
	static function mutableCookies():Promise<MutableRequestCookies>;

	@:jsRequire("next/headers", "draftMode")
	static function draftMode():Promise<DraftMode>;

	@:jsRequire("next/headers", "headers")
	static function headers():Promise<ReadonlyHeaders>;
}
