package server_functions_negative;

import genes.react.Element;
import server_functions_negative.raw.RawActions;

typedef RawActionClientProps = {}

/** Negative control: a client owner must select the generated action ref. */
@:next.clientComponent("components/RawActionClient")
class RawActionClient {
	public static function render(_props:RawActionClientProps):Element {
		RawActions.save("bypassed boundary");
		return <p>Unsafe raw action import</p>;
	}
}
