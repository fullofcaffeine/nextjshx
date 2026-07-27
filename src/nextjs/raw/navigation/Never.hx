package nextjs.raw.navigation;

/**
 * TypeScript's bottom type for APIs that always interrupt control flow.
 *
 * Haxe has no native `never`, so it sees an unconstructable extern marker.
 * genes-ts emits the exact bottom type at the public TypeScript boundary.
 */
@:ts.type("never")
extern class Never {}
