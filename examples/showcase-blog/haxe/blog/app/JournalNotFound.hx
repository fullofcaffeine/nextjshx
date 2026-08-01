package blog.app;

import blog.app.JournalPage;
import genes.react.Element;
import nextjs.components.NextLink;

/**
 * `@:next.notFound("journal")` owns `app/journal/not-found.tsx`. Calling
 * Next's native `notFound()` control flow from a child page selects this UI;
 * NextJsHx adds signature and ownership checks, not another error mechanism.
 *
 * This remains an all-static class only because the current special-file macro
 * still discovers a Haxe type owner. The page/layout API no longer needs that
 * shell; `nxhx-f34.9.9.2` tracks the equivalent module-level source shape
 * without changing Next's conventional default export.
 */
@:next.notFound("journal")
class JournalNotFound {
	public static function render():Element {
		return
			<main className="missing-dispatch"><span>404 / FIELD NOTE LOST</span><h1>The cairn ends here.</h1><p>This dispatch is not part of the current deterministic field journal.</p><NextLink href={JournalPage.href()}>Return to the trail index</NextLink></main>;
	}
}
