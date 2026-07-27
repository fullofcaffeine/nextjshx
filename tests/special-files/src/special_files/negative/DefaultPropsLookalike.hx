package special_files.negative;

import genes.react.Element;
import js.lib.Promise;

typedef DefaultParams = {
	final id:String;
}

typedef UnsafeDefaultProps = {
	final params:Promise<DefaultParams>;
}

@:next.default("negative/[id]/@sidebar")
class DefaultPropsLookalike {
	public static function render(props:UnsafeDefaultProps):Element {
		return <aside>invalid</aside>;
	}
}
