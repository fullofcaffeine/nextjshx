package page_layouts.negative;

import genes.react.Element;
import nextjs.app.LayoutProps;
import nextjs.raw.react.ReactNode;
import nextjs.route.NoParams;

typedef UnreviewedSlottedProps = {
	> LayoutProps<NoParams>,
	final modal:ReactNode;
}

@:next.layout("negative/missing-slot-marker")
class MissingSlotMarker {
	public static function render(props:UnreviewedSlottedProps):Element {
		return <section>{props.children}{props.modal}</section>;
	}
}
