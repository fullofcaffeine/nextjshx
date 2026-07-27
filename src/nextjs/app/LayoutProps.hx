package nextjs.app;

import js.lib.Promise;
import nextjs.raw.react.ReactNode;

/**
 * Haxe-facing props for one App Router layout declaration.
 *
 * For parallel routes, declare a named `@:next.layoutSlots` typedef that
 * extends this shape and adds one required immutable `ReactNode` field per
 * `@slot` directory. The declaration macro validates that closed shape and
 * validates `Params` against every dynamic segment inherited by the layout.
 */
typedef LayoutProps<Params> = {
	final children:ReactNode;
	final params:Promise<Params>;
}
