package todoapp.cache;

import js.lib.Promise;
import nextjs.raw.Cache;
import nextjs.raw.cache.CacheTypes.CacheLifeProfile;
import todoapp.cache.TodoCacheTag.forScope;
import todoapp.domain.Todo;
import todoapp.persistence.TodoStore.list as listTodos;

/**
 * `@:next.cache("todos/list")` generates a native cache-function adapter whose
 * body starts with `"use cache"`. `cacheLife` and `cacheTag` remain Next APIs;
 * callers use `CacheFunction.ref` so the server reference stays typed.
 */
@:next.cache("todos/list")
class CachedTodos {
	@:async
	public static function list(scope:String):Promise<Array<Todo>> {
		Cache.cacheLife(CacheLifeProfile.Hours);
		Cache.cacheTag(forScope(scope));
		return listTodos();
	}
}
