package nextjs.app;

import genes.ts.Undefinable;

private typedef ErrorBoundaryErrorShape = {
	final name:String;
	final message:String;
	final stack:Undefinable<String>;
	final digest:Undefinable<String>;
}

/**
 * Error supplied by Next to a segment `error.tsx` boundary.
 *
 * The Haxe view exposes the useful standard fields and Next's optional digest.
 * The emitted TypeScript retains the canonical intersection instead of
 * inventing a runtime wrapper or widening the value.
 */
@:forward(name, message, stack, digest)
@:ts.type("Error & { digest?: string }")
abstract ErrorBoundaryError(ErrorBoundaryErrorShape) {}
