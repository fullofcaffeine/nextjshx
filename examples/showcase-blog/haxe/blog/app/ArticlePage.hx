package blog.app;

import blog.app.JournalPage;
import blog.domain.Post;
import blog.domain.Post.PostSlug;
import blog.domain.PostCatalog.all;
import blog.domain.PostCatalog.find;
import blog.domain.PostCatalog.nextAfter;
import genes.js.Async.await;
import genes.react.Element;
import js.lib.Error;
import js.lib.Promise;
import nextjs.app.PageMetadataProps;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.raw.Navigation;
import nextjs.raw.metadata.Metadata;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Icons.ArrowRight;
import showcase.ui.Icons.IconProps;
import showcase.ui.Separator;

typedef ArticleParams = {
	final slug:PostSlug;
}

/**
 * Enumerates the closed catalogue slugs that Next prerenders at build time.
 *
 * The direct module function becomes Next's named `generateStaticParams`
 * export; the typed return shape must agree with the dynamic route contract.
 */
function generateStaticParams():Array<ArticleParams> {
	return all().map(post -> {slug: post.slug});
}

/**
 * Derives the native Next metadata result from the same typed catalogue used by
 * rendering and static params, so route content and document metadata cannot
 * silently drift into separate sources of truth.
 */
function generateMetadata(props:PageMetadataProps<ArticleParams, SearchParams>):Promise<Metadata> {
	return props.params.then(params -> {
		final post = find(params.slug);
		final metadata:Metadata = post == null ? {
			title: "Missing field note — Moraine"
		} : {
			title: post.title + " — Moraine",
			description: post.dek
			};
		return metadata;
	});
}

/**
 * Owns `app/journal/[slug]/page.tsx` as an ordinary module function.
 *
 * The bracket segment generates the exact `ArticleParams` contract and
 * `href({slug})` companion. The Promise chain stays a normal JavaScript Promise
 * chain; Next still owns Server Component rendering and request timing.
 */
@:next.page("journal/[slug]")
function render(props:PageProps<ArticleParams, SearchParams>):Promise<Element> {
	return props.params.then(params -> {
		final post = find(params.slug);
		return post == null ? missing() : renderArticle(post);
	});
}

/**
 * Narrows Next's interrupting `notFound()` control flow to an `Element` result
 * for the page branch while retaining the native 404 mechanism.
 */
private function missing():Element {
	Navigation.notFound();
	throw new Error("next/navigation.notFound returned instead of interrupting control flow");
}

/**
 * Renders one already-validated catalogue entry and its typed next link.
 *
 * Lookup and not-found control flow happen before this private helper, so the
 * HXX body receives a closed `Post`. Next still owns native Link navigation and
 * Server Component rendering.
 */
private function renderArticle(post:Post):Element {
	final body = post.paragraphs.map(paragraph -> <p>{paragraph}</p>);
	final next = nextAfter(post.slug);
	final badge:BadgeProps = {variant: BadgeVariant.Outline, className: "issue-badge"};
	final icon:IconProps = {size: 17, strokeWidth: 1.6};
	return <main className="article-shell">
			<header className="article-header"><NextLink className="journal-mark compact" href={JournalPage.href()}><span>M</span><strong>Moraine</strong></NextLink><NextLink className="back-index" href={JournalPage.href()}>All dispatches</NextLink></header>
			<article>
				<div className="article-lede">
					<div><Badge {...badge}>{post.kind}</Badge><span>{post.issue} / {post.published}</span></div>
					<h1>{post.title}</h1><p>{post.dek}</p>
				</div>
				<div className="article-contours" aria-hidden="true"><i></i><i></i><i></i><b>{post.elevation}</b></div>
				<div className="article-grid">
					<aside><span>LOCATION</span><strong>{post.location}</strong><small>{post.coordinates}</small><Separator /><span>READING TIME</span><strong>{post.minutes} minutes</strong></aside>
					<div className="article-body">{body}</div>
				</div>
			</article>
			<footer className="next-dispatch"><span>NEXT DISPATCH</span><NextLink href={href({slug: next.slug})}><strong>{next.title}</strong><ArrowRight {...icon} /></NextLink></footer>
		</main>;
}
