package nextjs.raw.lazy;

import haxe.extern.EitherType;
import nextjs.raw.react.ComponentType;

/** ES module shape accepted by Next's dynamic loader. */
typedef ComponentModule<Props> = {
	@:native("default") final component:ComponentType<Props>;
}

/** Asynchronous component value resolved by a dynamic loader. */
typedef LoaderComponent<Props> = js.lib.Promise<EitherType<ComponentType<Props>, ComponentModule<Props>>>;

/** Public loader input accepted by `next/dynamic`. */
typedef Loader<Props> = EitherType<Void->LoaderComponent<Props>, LoaderComponent<Props>>;
