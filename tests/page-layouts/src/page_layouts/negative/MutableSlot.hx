package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.react.ReactNode;
import nextjs.route.NoParams;

@:next.layoutSlots
typedef MutableSlotProps = {
	> LayoutProps<NoParams>,
	var modal:ReactNode;
}

@:next.layout("negative/mutable-slot")
class MutableSlot {
	public static function render(props:MutableSlotProps):Element {
		return <section>{props.children}</section>;
	}
}
