package nextjs.raw.types;

/** Compiler-only indexed storage used by the public tuple projection below. */
@:genes.compilerInternal
private typedef Tuple2Storage<A, B> = {
	@:native("[0]")
	var first:A;

	@:native("[1]")
	var second:B;
}

/**
 * Zero-runtime view of a mutable JavaScript two-element tuple.
 *
 * `@:ts.type("[$0, $1]")` is a genes-ts compile-time projection, not runtime
 * code. `$0` and `$1` are replaced with the emitted TypeScript forms of the
 * Haxe type parameters `A` and `B`, so `Tuple2<String, Int>` becomes
 * `[string, number]`. A tuple is required instead of `Array<A | B>` because
 * Haxe must prove that index 0 is exactly `A` and index 1 is exactly `B`.
 *
 * The accessors inline through `Tuple2Storage`: its `@:native` names are
 * computed member expressions, so `pair.first`/`pair.second` in Haxe emit as
 * `pair[0]`/`pair[1]`. The tuple remains mutable because faithful host
 * declarations such as React's `useState` result use mutable TypeScript
 * tuples. No tuple class, wrapper, or accessor call exists at runtime.
 */
@:ts.type("[$0, $1]")
abstract Tuple2<A, B>(Tuple2Storage<A, B>) {
	public var first(get, set):A;
	public var second(get, set):B;

	inline function get_first():A {
		return this.first;
	}

	inline function set_first(value:A):A {
		return this.first = value;
	}

	inline function get_second():B {
		return this.second;
	}

	inline function set_second(value:B):B {
		return this.second = value;
	}
}
