package nextjs.raw.integrations.dndkit;

import haxe.extern.EitherType;

/** Faithful projection of dnd-kit's public `string | number` identity. */
typedef DndIdentifier = EitherType<String, Float>;
