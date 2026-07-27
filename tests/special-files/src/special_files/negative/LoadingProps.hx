package special_files.negative;

import genes.react.Element;

@:next.loading("negative/loading-props")
class LoadingProps {
	public static function render(unexpected:String):Element {
		return <p>{unexpected}</p>;
	}
}
