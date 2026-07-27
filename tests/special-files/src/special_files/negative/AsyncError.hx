package special_files.negative;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.ErrorProps;

@:next.error("negative/async-error")
class AsyncError {
	public static function render(props:ErrorProps):Promise<Element> {
		return Promise.resolve(<p>{props.error.message}</p>);
	}
}
