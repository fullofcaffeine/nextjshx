package special_files.negative;

import genes.react.Element;
import nextjs.app.ErrorProps;

@:next.error("negative/reset-argument")
class ResetArgument {
	public static function render(props:ErrorProps):Element {
		props.reset("unsafe");
		return <main>invalid</main>;
	}
}
