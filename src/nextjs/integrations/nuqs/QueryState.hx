package nextjs.integrations.nuqs;

import js.html.URLSearchParams;
import js.lib.Promise;
import nextjs.raw.integrations.nuqs.QueryOptions;
import nextjs.raw.integrations.nuqs.QueryStateResult;
import nextjs.raw.integrations.nuqs.QueryStateResult.QueryClear;
import nextjs.raw.integrations.nuqs.QueryStateResult.QueryNext;

/**
 * Allocation-free semantic view of one nuqs URL-state tuple.
 *
 * `Value` is the serialized domain value. `Current` is either `Value` for a
 * defaulted parser or `Null<Value>` for a nullable parser. The distinction is
 * retained in Haxe while the abstract erases to nuqs's original tuple.
 */
abstract QueryState<Value, Current>(QueryStateResult<Value, Current>) {
	/** Current value for this render. */
	public var value(get, never):Current;

	inline function get_value():Current {
		return this.first;
	}

	/** Replaces the query value and returns nuqs's applied URL parameters. */
	public inline function set(next:Value):Promise<URLSearchParams> {
		return this.second.invoke(next);
	}

	/** Computes the next query value from the current render-safe value. */
	public inline function update(reducer:Current->QueryNext<Value>):Promise<URLSearchParams> {
		return this.second.invoke(reducer);
	}

	/** Removes the query key; a defaulted parser then exposes its default. */
	public inline function clear():Promise<URLSearchParams> {
		return this.second.invoke(QueryClear.value());
	}

	/** Replaces the value with one call-specific nuqs option set. */
	public inline function setWithOptions(next:Value, options:QueryOptions):Promise<URLSearchParams> {
		return this.second.invoke(next, options);
	}

	/** Applies an update with one call-specific nuqs option set. */
	public inline function updateWithOptions(reducer:Current->QueryNext<Value>, options:QueryOptions):Promise<URLSearchParams> {
		return this.second.invoke(reducer, options);
	}

	/** Clears the key with one call-specific nuqs option set. */
	public inline function clearWithOptions(options:QueryOptions):Promise<URLSearchParams> {
		return this.second.invoke(QueryClear.value(), options);
	}
}

/** Query state whose absent or invalid URL value is represented by `null`. */
typedef NullableQueryState<Value> = QueryState<Value, Null<Value>>;

/** Query state whose absent or invalid URL value resolves to a parser default. */
typedef DefaultQueryState<Value> = QueryState<Value, Value>;
