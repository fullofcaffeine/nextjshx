package next_server;

import nextjs.raw.Cache;

class NegativeRevalidateTag {
	static function main():Void {
		Cache.revalidateTag("todos");
	}
}
