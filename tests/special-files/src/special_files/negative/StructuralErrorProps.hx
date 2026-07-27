package special_files.negative;

import genes.react.Element;
import nextjs.app.ErrorBoundaryError;

typedef ErrorPropsLookalike = {
	final error:ErrorBoundaryError;
	final reset:String->Void;
}

@:next.error("negative/error-props")
class StructuralErrorProps {
	public static function render(props:ErrorPropsLookalike):Element {
		return <button onClick={() -> props.reset("unsafe")}>invalid</button>;
	}
}
