package nextjs.raw.integrations.nuqs;

import haxe.extern.EitherType;
import js.html.URLSearchParams;
import js.lib.Promise;
import nextjs.raw.types.Tuple2;

@:genes.compilerInternal
private extern class QueryClearStorage {}

/** Dedicated nullable arm that emits as the JavaScript and TypeScript null value. */
@:ts.type("null")
abstract QueryClear(Null<QueryClearStorage>) from Null<QueryClearStorage> {
	/** Exact null value used by the callable setter overload. */
	public static inline function value():QueryClear {
		return null;
	}
}

/** A parsed replacement value or an explicit request to remove the query key. */
typedef QueryNext<Value> = EitherType<Value, QueryClear>;

/** Functional URL-state transition accepted by the faithful nuqs setter. */
typedef QueryUpdater<Value, Current> = Current->QueryNext<Value>;

/** Raw replacement, clearing value, or updater accepted by nuqs. */
typedef QuerySetAction<Value, Current> = EitherType<QueryNext<Value>, QueryUpdater<Value, Current>>;

/** Exact asynchronous callable returned by nuqs. */
@:ts.type("(value: null | $0 | ((old: $1) => $0 | null), options?: import('nuqs').Options) => Promise<URLSearchParams>")
extern class QuerySetter<Value, Current> {
	@:selfCall
	@:overload(function(value:Value, ?options:QueryOptions):Promise<URLSearchParams> {})
	@:overload(function(updater:QueryUpdater<Value, Current>, ?options:QueryOptions):Promise<URLSearchParams> {})
	function invoke(value:QueryClear, ?options:QueryOptions):Promise<URLSearchParams>;
}

/** Exact mutable tuple returned by `useQueryState`. */
typedef QueryStateResult<Value, Current> = Tuple2<Current, QuerySetter<Value, Current>>;

/** Result when a missing or invalid query value becomes `null`. */
typedef NullableQueryStateResult<Value> = QueryStateResult<Value, Null<Value>>;

/** Result when the parser supplies a non-null default value. */
typedef DefaultQueryStateResult<Value> = QueryStateResult<Value, Value>;
