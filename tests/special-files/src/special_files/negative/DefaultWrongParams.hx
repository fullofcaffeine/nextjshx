package special_files.negative;

import genes.react.Element;
import nextjs.app.DefaultProps;
import nextjs.route.NoParams;

@:next.default("negative/[id]/@sidebar")
class DefaultWrongParams {
	public static function render(props:DefaultProps<NoParams>):Element {
		return <aside>invalid</aside>;
	}
}
