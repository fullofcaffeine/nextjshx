package nextjs.raw.metadata;

/**
 * Faithful raw viewport object from Next's public root entrypoint.
 *
 * The canonical TypeScript projection retains literal unions such as
 * `viewportFit` and `colorScheme` while keeping the Haxe representation free
 * of Dynamic and duplicated internal Next declarations.
 */
@:ts.type("import('next').Viewport")
abstract Viewport({}) from {} {}
