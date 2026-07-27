package special_files.negative;

import nextjs.app.ErrorProps;

@:next.error("negative/return")
class WrongReturn {
	public static function render(props:ErrorProps):String {
		return props.error.message;
	}
}
