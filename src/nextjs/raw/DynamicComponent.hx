package nextjs.raw;

import haxe.extern.EitherType;
import nextjs.raw.lazy.DynamicOptions;
import nextjs.raw.lazy.Loader;
import nextjs.raw.react.ComponentType;

/** Direct public binding for the default `next/dynamic` loader function. */
extern class DynamicComponent {
	@:jsRequire("next/dynamic", "default")
	static function load<Props>(source:EitherType<DynamicOptions<Props>, Loader<Props>>, ?options:DynamicOptions<Props>):ComponentType<Props>;
}
