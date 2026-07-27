package next_server;

import nextjs.raw.Cache;

class NegativeCacheProfile {
	static function main():Void {
		Cache.cacheLife("minutes");
	}
}
