package special_files.negative;

import genes.react.Element;

@:next.notFound("negative/not-found-props")
class NotFoundProps {
	public static function render(unexpected:String):Element {
		return <p>{unexpected}</p>;
	}
}
