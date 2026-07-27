package nextjs.client;

/**
 * A Promise whose provider guarantees stable identity across React renders.
 *
 * There is deliberately no conversion from an ordinary `Promise<T>`: this
 * capability must come from a reviewed cache, framework boundary, or extern
 * contract that actually owns the identity guarantee.
 */
@:ts.type("Promise<$0>")
extern class CachedPromise<T> {}
