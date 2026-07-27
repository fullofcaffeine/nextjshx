package todoapp.cache;

import todoapp.persistence.TodoStore;

/** One stable invalidation namespace shared by readers and mutation boundaries. */
class TodoCacheTag {
	static inline final PREFIX = "todoapp.todos";

	public static function current():String {
		return forScope(TodoStore.cacheScope());
	}

	public static function forScope(scope:String):String {
		return PREFIX + "." + scope;
	}
}
