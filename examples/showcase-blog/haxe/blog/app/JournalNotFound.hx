package blog.app;

import genes.react.Element;
import nextjs.components.NextLink;

/** Segment-owned missing dispatch rendered by Next's ordinary 404 flow. */
@:next.notFound("journal")
class JournalNotFound {
	public static function render():Element {
		return
			<main className="missing-dispatch"><span>404 / FIELD NOTE LOST</span><h1>The cairn ends here.</h1><p>This dispatch is not part of the current deterministic field journal.</p><NextLink href={JournalPage.href()}>Return to the trail index</NextLink></main>;
	}
}
