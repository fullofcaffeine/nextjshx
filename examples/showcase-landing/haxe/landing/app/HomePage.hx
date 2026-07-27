package landing.app;

import genes.react.Element;
import landing.client.TideDial;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeProps;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Button.ButtonSize;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.SlottedButton;
import showcase.ui.Card;
import showcase.ui.Card.CardProps;
import showcase.ui.Card.CardContent;
import showcase.ui.Icons.ArrowRight;
import showcase.ui.Icons.CircleGauge;
import showcase.ui.Icons.IconProps;
import showcase.ui.Icons.Waves;

using nextjs.client.ClientComponent;

/**
 * `@:next.page("")` maps this checked Haxe class to the root `app/page.tsx`.
 * The empty segment means `/`; the generated `HomePage.href()` companion is
 * therefore a typed root href rather than a duplicated path string.
 */
@:next.page("")
class HomePage {
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		// `.client()` yields the only identity that may place this hydrated
		// component in Server Component HXX; importing its implementation would
		// cross the server/client boundary incorrectly.
		final Tide = TideDial.client();
		final launchBadge:BadgeProps = {variant: BadgeVariant.Outline, className: "launch-badge"};
		final metricCard:CardProps = {className: "metric-card"};
		final icon:IconProps = {size: 18, strokeWidth: 1.6};
		return <main>
			<header className="site-header">
				<NextLink className="wordmark" href={HomePage.href()}><Waves {...icon} /><span>Pelagic Signal</span></NextLink>
				<nav aria-label="Primary navigation">
					<a href="#network">Network</a><a href="#method">Method</a><a href="#contact">Contact</a>
				</nav>
				<span className="header-status">07 stations online</span>
			</header>

			<section className="hero">
				<div className="hero-copy">
					<Badge {...launchBadge}>North Pacific / 24.06</Badge>
					<p className="hero-kicker">Coastal intelligence for decisions that cannot wait.</p>
					<h1>Read the coast<br /><em>before it changes.</em></h1>
					<p className="hero-summary">Pelagic Signal turns live buoys, tidal models, and field observations into one calm operating picture for ports and coastal teams.</p>
					<div className="hero-actions">
						<SlottedButton size={ButtonSize.Large} className="hero-action" asChild><a href="#network">Explore the network <ArrowRight {...icon} /></a></SlottedButton>
						<SlottedButton size={ButtonSize.Large} variant={ButtonVariant.Outline} className="hero-action secondary-action" asChild><a href="#contact">Request a field brief</a></SlottedButton>
					</div>
				</div>
				<div className="hero-instrument">
					<Tide station="PS–07" initialLevel={62} updated="18:42 UTC" />
					<div className="instrument-caption"><span>01</span><p>Hydrated Haxe client reading<br />over a native Next boundary.</p></div>
				</div>
			</section>

			<section id="network" className="network-grid">
				<div className="section-heading"><span>THE SIGNAL NETWORK</span><h2>Seven stations.<br />One coastal pulse.</h2></div>
				<Card {...metricCard}>
					<CardContent className="metric-content"><CircleGauge {...icon} /><strong>14.2<span>s</span></strong><p>median packet latency</p></CardContent>
				</Card>
				<Card {...metricCard}>
					<CardContent className="metric-content"><Waves {...icon} /><strong>96.8<span>%</span></strong><p>forecast confidence</p></CardContent>
				</Card>
				<div className="station-map" aria-label="Abstract network map">
					<span className="map-line one"></span><span className="map-line two"></span><span className="map-line three"></span>
					<i className="station s1"></i><i className="station s2"></i><i className="station s3"></i><i className="station s4"></i>
					<p>46° 37′ N<br />124° 03′ W</p>
				</div>
			</section>

			<section id="method" className="method-band">
				<p className="method-index">02 / METHOD</p>
				<div><h2>Field-grade inputs.<br />Human-scale outputs.</h2><p>We preserve the uncertainty, provenance, and cadence behind every reading—then present only what a shift lead needs to act.</p></div>
				<ol><li><span>01</span>Sense</li><li><span>02</span>Reconcile</li><li><span>03</span>Brief</li></ol>
			</section>

			<footer id="contact" className="site-footer">
				<p>Build a calmer coastal picture.</p><a href="mailto:field@pelagic.example">field@pelagic.example <ArrowRight {...icon} /></a><small>Fictional product / NextJsHx showcase</small>
			</footer>
		</main>;
	}
}
