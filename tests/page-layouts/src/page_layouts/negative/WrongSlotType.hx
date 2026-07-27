package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.route.NoParams;

@:next.layoutSlots
typedef WrongSlotTypeProps = {
	> LayoutProps<NoParams>,
	final modal:String;
}

@:next.layout("negative/wrong-slot-type")
class WrongSlotType {
	public static function render(props:WrongSlotTypeProps):Element {
		return <section>{props.children}</section>;
	}
}
