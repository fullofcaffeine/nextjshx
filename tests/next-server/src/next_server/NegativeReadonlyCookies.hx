package next_server;

import nextjs.raw.headers.CookieTypes.ReadonlyRequestCookies;

class NegativeReadonlyCookies {
	static function main():Void {}

	static function mutate(cookies:ReadonlyRequestCookies):Void {
		cookies.set("session", "unsafe");
	}
}
