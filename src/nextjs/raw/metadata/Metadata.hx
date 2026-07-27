package nextjs.raw.metadata;

/**
 * Faithful raw Metadata object from Next's public root entrypoint.
 *
 * Metadata's nested field graph is intentionally delegated to the canonical
 * TypeScript type. This keeps every upstream field available to Haxe object
 * literals without copying hundreds of transitive declarations or weakening
 * them to Dynamic; strict generated-TypeScript validation remains authoritative.
 */
@:ts.type("import('next').Metadata")
abstract Metadata({}) from {} {}
