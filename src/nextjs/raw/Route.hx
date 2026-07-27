package nextjs.raw;

/**
 * Raw form of Next's public `Route<T>` type.
 *
 * This mirrors Next's string fallback. Prefer generated `nextjs.route.RouteHref`
 * values when an application route is known at compile time.
 */
@:ts.type("import('next').Route<$0>")
abstract Route<Infer>(String) from String to String {}
