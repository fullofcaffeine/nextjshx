package mixed_adoption.app;

import genes.react.Element;
import mixed_adoption.client.HaxePatchConsole;
import mixed_adoption.client.HaxePatchConsole.PatchAccent;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.navigation.SameZone;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;

using nextjs.client.ClientComponent;

/**
 * `@:next.page("haxe-lab")` declares the App Router segment. NextJsHx checks
 * the page signature and owns only the resulting `app/haxe-lab/page.tsx`
 * adapter; Next still discovers and renders that conventional file.
 */
@:next.page("haxe-lab")
class HaxeLabPage {
	/**
	 * Composes the Haxe-owned route from native and Haxe-owned client entries.
	 *
	 * The server page passes only closed serializable props across each client
	 * boundary. Native React still hydrates both entries in the same module
	 * graph; this function introduces no interop runtime.
	 */
	public static function render(_:PageProps<NoParams, SearchParams>):Element {
		// `.client()` is the checked Haxe equivalent of importing a generated
		// Client Component identity into this Server Component's HXX.
		final Console = HaxePatchConsole.client();
		final badge:BadgeProps = {variant: BadgeVariant.Outline, className: "language-badge"};
		return <main className="haxe-lab">
			<header className="masthead">
				<NextLink className="wordmark" href={SameZone.href("/")}><span className="wordmark-mark">P/06</span><span>Patchbay</span></NextLink>
				<nav aria-label="Primary navigation"><NextLink href={SameZone.href("/")}>Native route</NextLink><a href="#reverse-bridge">Reverse bridge</a></nav>
				<span className="masthead-status"><i /> Haxe route online</span>
			</header>
			<section className="lab-hero">
				<div className="hero-index">02 — HAXE ADOPTION</div>
				<div>
					<Badge {...badge}>Manifest-owned Haxe route</Badge>
					<h1>Reverse the current.<br /><em>Keep every contract.</em></h1>
					<p>This page, its HXX, route identity, and hydrated leaf are authored in Haxe. The interactive console consumes a native TypeScript Hook, component, and ordinary module through closed externs.</p>
				</div>
			</section>
			<section id="reverse-bridge" className="reverse-bridge">
				<div className="section-rail"><span>LIVE PATCH / HX → TS</span><strong>zero-runtime externs</strong></div>
				<Console label="Haxe client component / native internals" initialLevel={52} accent={PatchAccent.Signal} />
			</section>
		</main>;
	}
}
