package field_atlas.app;

import genes.react.Element;
import nextjs.app.PageProps;
import nextjs.components.NextLink;
import nextjs.navigation.SameZone;
import nextjs.route.NoParams;
import nextjs.route.SearchParams;
import showcase.ui.Badge;
import showcase.ui.Badge.BadgeVariant;
import showcase.ui.Button.ButtonVariant;
import showcase.ui.Button.SlottedButton;
import showcase.ui.Card;
import showcase.ui.Card.CardContent;
import showcase.ui.Card.CardHeader;
import showcase.ui.Icons.ArrowRight;
import showcase.ui.Icons.BookOpenText;
import showcase.ui.Icons.CircleGauge;
import showcase.ui.Icons.IconProps;
import showcase.ui.Icons.Leaf;

/**
 * `@:next.page("")` declares the root Server Component page. NextJsHx emits
 * only the conventional adapter and generates `HomePage.href()` for `/`.
 */
@:next.page("")
class HomePage {
	/**
	 * Composes the atlas index from trusted local links and typed client data.
	 *
	 * The page keeps trusted MDX and decoded portable content as visibly
	 * different paths, then passes only closed chart props through the generated
	 * Client Component boundary. Next owns routing, streaming, and hydration.
	 */
	public static function render(props:PageProps<NoParams, SearchParams>):Element {
		final icon:IconProps = {size: 17, strokeWidth: 1.5};
		return <main>
			<header className="atlas-header">
				<NextLink className="atlas-wordmark" href={HomePage.href()}><span>FA</span><strong>Field Atlas</strong></NextLink>
				<nav aria-label="Atlas navigation"><a href="#method">Method</a><NextLink href={SameZone.href("/dispatches/soil-signals")}>Dispatch 04</NextLink><NextLink href={BriefingPage.href()}>Remote brief</NextLink></nav>
				<span className="edition">VOL. 01 / 2026</span>
			</header>

			<section className="atlas-hero">
				<div className="hero-copy">
					<Badge variant={BadgeVariant.Outline} className="atlas-badge">LIVING SYSTEMS / OPEN LEDGER</Badge>
					<h1>Read the ground.<br /><em>Keep the signal.</em></h1>
					<p>Field Atlas turns observations into legible evidence: authored locally in MDX, instrumented with Haxe components, and portable across trusted content systems.</p>
					<div className="hero-actions">
						<SlottedButton asChild variant={ButtonVariant.Default}><NextLink href={SameZone.href("/dispatches/soil-signals")}>Open dispatch 04 <ArrowRight {...icon} /></NextLink></SlottedButton>
						<SlottedButton asChild variant={ButtonVariant.Outline}><NextLink href={BriefingPage.href()}>Inspect decoded brief</NextLink></SlottedButton>
					</div>
				</div>
				<div className="hero-plate" aria-label="Abstract field sampling grid">
					<span className="plate-axis x">47° 18′ 22″ N</span>
					<span className="plate-axis y">122° 05′ 09″ W</span>
					<div className="sample s1"><b>01</b><i></i></div>
					<div className="sample s2"><b>02</b><i></i></div>
					<div className="sample s3"><b>03</b><i></i></div>
					<strong>CANOPY<br />TRANSECT<br /><small>Δ +14.2</small></strong>
				</div>
			</section>

			<section className="signal-strip">
				<div><span>ACTIVE PLOTS</span><strong>06</strong><small>rain shadow / estuary</small></div>
				<div><span>OBSERVATIONS</span><strong>2,418</strong><small>normalized / reviewed</small></div>
				<div><span>LAST INGEST</span><strong>08:42</strong><small>UTC−07 / clean</small></div>
				<div><span>OPEN ANOMALIES</span><strong>03</strong><small>one requires return</small></div>
			</section>

			<section id="method" className="method-grid">
				<div className="section-index"><span>METHOD / 01</span><h2>One atlas.<br />Two trust models.</h2></div>
				<Card className="method-card">
					<CardHeader><BookOpenText {...icon} /><Badge variant={BadgeVariant.Secondary}>LOCAL MDX</Badge><h3>Authored dispatches</h3></CardHeader>
					<CardContent><p>Repository-owned essays keep the full native MDX toolchain, including GFM, heading anchors, highlighted code, and precisely registered Haxe islands.</p><NextLink href={SameZone.href("/dispatches/soil-signals")}>Read the soil signal <ArrowRight {...icon} /></NextLink></CardContent>
				</Card>
				<Card className="method-card oxide">
					<CardHeader><CircleGauge {...icon} /><Badge variant={BadgeVariant.Outline}>PORTABLE JSON</Badge><h3>Decoded observations</h3></CardHeader>
					<CardContent><p>Remote content never becomes JSX. Exact fields decode into a closed block algebra; every renderer stays exhaustive as the shared protocol evolves.</p><NextLink href={BriefingPage.href()}>Inspect the briefing <ArrowRight {...icon} /></NextLink></CardContent>
				</Card>
			</section>

			<section className="field-principle">
				<Leaf size={28} strokeWidth={1.2} />
				<p>“The interface should feel like evidence, not decoration.”</p>
				<span>FIELD PRINCIPLE / 07</span>
			</section>

			<footer className="atlas-footer"><strong>Field Atlas</strong><p>A fictional research publication demonstrating Next-native MDX, Haxe-authored React, and safe portable content.</p><small>NextJsHx / specimen build 01</small></footer>
		</main>;
	}
}
