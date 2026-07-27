package nextjshx.client;

import nextjs.raw.react.Dispatch;
import nextjs.raw.react.SetStateAction;

/** Internal runtime bridge used only for callable React state replacement. */
@:noCompletion
class StateRuntime {
	public static function replaceCallable<Value>(dispatch:Dispatch<SetStateAction<Value>>, next:Value):Void {
		dispatch(_previous -> next);
	}
}
