package todoapp.cache;

import todoapp.persistence.TodoStore.cacheScope;

/** One stable invalidation namespace shared by readers and mutation boundaries. */
inline final PREFIX = "todoapp.todos";

/** Returns the cache identity for the active isolated application run. */
function current():String {
	return forScope(cacheScope());
}

/** Names one cache scope without duplicating the namespace at call sites. */
function forScope(scope:String):String {
	return PREFIX + "." + scope;
}
