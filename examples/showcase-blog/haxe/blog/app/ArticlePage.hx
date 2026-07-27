package blog.app;

import blog.domain.Post;
import blog.domain.Post.PostSlug;
import blog.domain.PostCatalog;
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

@:next.page("journal/[slug]")
class ArticlePage {
	public static function generateStaticParams():Array<ArticleParams> {
		return PostCatalog.all().map(post -> {slug: post.slug});
	}

	public static function generateMetadata(props:PageMetadataProps<ArticleParams, SearchParams>):Promise<Metadata> {
		return props.params.then(params -> {
			final post = PostCatalog.find(params.slug);
			final metadata:Metadata = post == null ? {
				title: "Missing field note — Moraine"
			} : {
				title: post.title + " — Moraine",
				description: post.dek
				};
			return metadata;
		});
	}

	@:async
	public static function render(props:PageProps<ArticleParams, SearchParams>):Promise<Element> {
		final params = await(props.params);
		final post = PostCatalog.find(params.slug);
		return post == null ? missing() : renderArticle(post);
	}

	static function missing():Element {
		Navigation.notFound();
		throw new Error("next/navigation.notFound returned instead of interrupting control flow");
	}

	static function renderArticle(post:Post):Element {
		final body = post.paragraphs.map(paragraph -> <p>{paragraph}</p>);
		final next = PostCatalog.nextAfter(post.slug);
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
			<footer className="next-dispatch"><span>NEXT DISPATCH</span><NextLink href={ArticlePage.href({slug: next.slug})}><strong>{next.title}</strong><ArrowRight {...icon} /></NextLink></footer>
		</main>;
	}
}
