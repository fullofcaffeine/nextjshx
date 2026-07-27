package nextjs.raw.types;

/** Compiler-only indexed storage used by the public tuple projection below. */
@:genes.compilerInternal
private typedef Tuple3Storage<A, B, C> = {
	@:native("[0]")
	var first:A;

	@:native("[1]")
	var second:B;

	@:native("[2]")
	var third:C;
}

/**
 * Zero-runtime view of a mutable JavaScript/TypeScript three-element tuple.
 *
 * `@:ts.type("[$0, $1, $2]")` substitutes the emitted TypeScript forms of
 * `A`, `B`, and `C` into one positional tuple. The indexed storage metadata
 * makes Haxe accessors emit as `[0]`, `[1]`, and `[2]`; no wrapper exists at
 * runtime.
 */
@:ts.type("[$0, $1, $2]")
abstract Tuple3<A, B, C>(Tuple3Storage<A, B, C>) {
	public var first(get, set):A;
	public var second(get, set):B;
	public var third(get, set):C;

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

	inline function get_third():C {
		return this.third;
	}

	inline function set_third(value:C):C {
		return this.third = value;
	}
}
