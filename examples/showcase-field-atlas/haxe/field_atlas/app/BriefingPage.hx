package field_atlas.app;

import field_atlas.content.LocalContentFiles.readBrief;
import genes.react.Element;
import js.lib.Error;
import nextjs.app.PageProps;
import nextjs.codec.DecodeResult;
import nextjs.components.NextLink;
import nextjs.content.ContentBlockRenderer;
import nextjs.content.PortableContentDecoder;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeVariant;

/**
 * Decodes and renders one CMS-like JSON brief at the server route boundary.
 *
 * `@:next.page("briefing")` owns the ordinary `app/briefing/page.tsx`
 * convention. Raw file text is decoded immediately into the closed portable
 * content algebra; rejected fields become a server error and payload data can
 * never execute JSX. Next still owns Server Component rendering and routing.
 */
@:next.page("briefing")
class BriefingPage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final source = readBrief();
		final blocks = switch PortableContentDecoder.json(source) {
			case Decoded(value): value;
			case Rejected(issues):
				final summary = issues.map(issue -> issue.code + " at " + issue.path).join("; ");
				throw new Error("Portable field brief rejected: " + summary);
		};
		return <main className="brief-page">
			<header className="brief-header">
				<NextLink href={HomePage.href()}>← Field Atlas</NextLink>
				<Badge variant={BadgeVariant.Outline}>DECODED PORTABLE CONTENT</Badge>
				<span>REMOTE BRIEF / 06</span>
			</header>
			<section className="brief-intro"><span>TRUST BOUNDARY</span><h1>Data arrived.<br /><em>Code did not.</em></h1><p>This page reads JSON at the server boundary, validates every field, and renders an exhaustive Haxe content algebra. The source cannot import a component or execute JSX.</p></section>
			<article className="brief-content">{ContentBlockRenderer.render(blocks)}</article>
		</main>;
	}
}
