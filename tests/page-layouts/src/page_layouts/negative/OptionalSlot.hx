package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.react.ReactNode;
import nextjs.route.NoParams;

@:next.layoutSlots
typedef OptionalSlotProps = {
	> LayoutProps<NoParams>,
	final ?modal:ReactNode;
}

@:next.layout("negative/optional-slot")
class OptionalSlot {
	public static function render(props:OptionalSlotProps):Element {
		return <section>{props.children}</section>;
	}
}
