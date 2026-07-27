package cache_boundaries_negative;

import js.lib.Promise;

private class Session {
	public final id:String;

	public function new(id:String) {
		this.id = id;
	}
}

@:next.cache("invalid/class")
class ClassArgument {
	@:async
	public static function read(session:Session):Promise<String> {
		return session.id;
	}
}
