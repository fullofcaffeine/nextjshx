package todoapp.cache;

import js.lib.Promise;
import nextjs.raw.Cache;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;
import todoapp.domain.Todo;
import todoapp.persistence.TodoStore;

/** Reusable shared-cache boundary around the deterministic todo projection. */
@:next.cache("todos/list")
class CachedTodos {
	@:async
	public static function list(scope:String):Promise<Array<Todo>> {
		Cache.cacheLife(CacheLifeProfile.Hours);
		Cache.cacheTag(TodoCacheTag.forScope(scope));
		return TodoStore.list();
	}
}
