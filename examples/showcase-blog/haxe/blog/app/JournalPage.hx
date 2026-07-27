package blog.app;

import blog.domain.Post;
import blog.domain.PostCatalog.featured;
import blog.domain.PostCatalog.fieldNotes;
import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.SlottedButton;
import showcase.ui.Card;
import showcase.ui.Card.CardContent;
import showcase.ui.Card.CardHeader;
import showcase.ui.Card.CardProps;
import showcase.ui.Icons.ArrowRight;
import showcase.ui.Icons.BookOpenText;
import showcase.ui.Icons.IconProps;
import showcase.ui.Separator;

/**
 * `@:next.page("")` declares the root App Router page. Its checked signature
 * produces the ordinary `app/page.tsx`, while `JournalPage.href()` avoids a
 * second hand-maintained copy of `/`.
 */
@:next.page("")
class JournalPage {
	/**
	 * Composes the journal landing page from one typed catalogue.
	 *
	 * The lead story and secondary cards are derived once, then HXX validates
	 * every shared component prop and child. Generated href companions keep
	 * article links aligned with the dynamic route while Next performs normal
	 * Server Component rendering.
	 */
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final featuredPost = featured();
		final secondaryPosts = fieldNotes().map(renderPostCard);
		final outline:BadgeProps = {variant: BadgeVariant.Outline, className: "issue-badge"};
		final icon:IconProps = {size: 17, strokeWidth: 1.6};
		return <main>
			<header className="journal-header">
				<NextLink className="journal-mark" href={JournalPage.href()}><span>M</span><strong>Moraine</strong><small>Field journal / est. 2019</small></NextLink>
				<nav aria-label="Journal navigation"><a href="#dispatches">Dispatches</a><a href="#practice">Practice</a><a href="#about">About</a></nav>
				<span className="season-stamp">Summer / Vol. VI</span>
			</header>

			<section className="journal-hero">
				<div className="hero-index"><span>FIELD NOTE 018</span><i></i><span>45° 13′ N</span></div>
				<div className="hero-title"><p>A journal for the landscapes<br />that outlast us.</p><h1>Notes from<br />the <em>long trail.</em></h1></div>
				<div className="contour-plate" aria-label="Abstract topographic contour drawing">
					<span className="contour c1"></span><span className="contour c2"></span><span className="contour c3"></span><span className="contour c4"></span><b>1,684 M</b>
				</div>
			</section>

			<section id="dispatches" className="featured-story">
				<div className="featured-label"><Badge {...outline}>{featuredPost.kind}</Badge><span>{featuredPost.issue} / {featuredPost.published}</span></div>
				<div className="featured-copy">
					<h2>{featuredPost.title}</h2><p>{featuredPost.excerpt}</p>
					<SlottedButton variant={ButtonVariant.Outline} className="read-button" asChild><NextLink href={ArticlePage.href({slug: featuredPost.slug})}>Read the field note <ArrowRight {...icon} /></NextLink></SlottedButton>
				</div>
				<aside><BookOpenText {...icon} /><span>{featuredPost.minutes} min read</span><strong>{featuredPost.location}</strong><small>{featuredPost.coordinates}</small></aside>
			</section>

			<section className="dispatch-grid">{secondaryPosts}</section>

			<section id="practice" className="practice-band">
				<p>THE PRACTICE / 03</p><div><h2>Walk softly.<br />Record precisely.</h2><p>Each dispatch pairs field observation with the practical choices that keep a place resilient. No sponsored summits. No geotagged shortcuts.</p></div>
				<Separator className="practice-rule" />
				<ol><li><span>01</span>Observe before acting</li><li><span>02</span>Leave useful evidence</li><li><span>03</span>Protect the return</li></ol>
			</section>

			<footer id="about" className="journal-footer"><strong>Moraine</strong><p>Independent notes on trail craft, public lands, and the discipline of returning.</p><small>Fictional publication / NextJsHx showcase</small></footer>
		</main>;
	}

	static function renderPostCard(post:Post):Element {
		final card:CardProps = {className: "dispatch-card"};
		final badge:BadgeProps = {variant: BadgeVariant.Outline};
		final icon:IconProps = {size: 16, strokeWidth: 1.5};
		return <Card {...card}>
			<CardHeader><div><Badge {...badge}>{post.kind}</Badge><span>{post.issue}</span></div><h3>{post.title}</h3></CardHeader>
			<CardContent><p>{post.excerpt}</p><NextLink href={ArticlePage.href({slug: post.slug})}>Continue reading <ArrowRight {...icon} /></NextLink></CardContent>
		</Card>;
	}
}
