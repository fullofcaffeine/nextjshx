package blog.app;

import genes.react.Element;
import nextjs.components.NextLink;

/**
 * `@:next.notFound("journal")` owns `app/journal/not-found.tsx`. Calling
 * Next's native `notFound()` control flow from a child page selects this UI;
 * NextJsHx adds signature and ownership checks, not another error mechanism.
 */
@:next.notFound("journal")
class JournalNotFound {
	public static function render():Element {
		return
			<main className="missing-dispatch"><span>404 / FIELD NOTE LOST</span><h1>The cairn ends here.</h1><p>This dispatch is not part of the current deterministic field journal.</p><NextLink href={JournalPage.href()}>Return to the trail index</NextLink></main>;
	}
}
