package next_components;

import genes.react.Element;
import nextjs.components.NextForm;
import nextjs.components.NextImage;
import nextjs.components.NextLink;
import nextjs.components.NextScript;
import nextjs.navigation.CrossZone;
import nextjs.navigation.SameZone;
import nextjs.raw.components.FormProps;
import nextjs.raw.components.ImageProps;
import nextjs.raw.components.ScriptProps.ScriptStrategy;

/** Proves semantic component names remain value tags without static-use help. */
class SemanticComponentConsumer {
	public static function render():Element {
		final image:ImageProps = {
			src: "/hero.png",
			alt: "Semantic component",
			width: 640,
			height: 360
		};
		final form:FormProps<String> = {action: "/search"};
		return <main>
			<NextLink href={SameZone.href("/products")}>Products</NextLink>
			<a href={CrossZone.href("/documentation")}>Documentation zone</a>
			<NextImage {...image} />
			<NextForm action={form.action}><button type={"submit"}>Search</button></NextForm>
			<NextScript src="https://example.test/widget.js" strategy={ScriptStrategy.AfterInteractive} />
		</main>;
	}
}
