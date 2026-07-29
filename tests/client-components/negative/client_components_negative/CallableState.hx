package client_components_negative;

import genes.react.React.useState;

typedef CallableStateFormatter = String->String;

/** A callable value is ambiguous at React's raw initializer boundary. */
class CallableState {
	@:next.hook
	public static function useFormatter(initial:CallableStateFormatter):Void {
		useState(initial);
	}
}
