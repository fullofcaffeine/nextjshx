package app;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.route.SearchParams;
import app.PhotoPage.PhotoParams;

/** Soft-navigation-only presentation of the canonical photo route. */
@:next.page("@modal/(.)photo/[id]")
class InterceptedPhotoPage {
	public static function render(props:PageProps<PhotoParams, SearchParams>):Element {
		return <dialog id="photo-modal" open>
			<p>Intercepted Haxe photo modal</p>
		</dialog>;
	}
}
