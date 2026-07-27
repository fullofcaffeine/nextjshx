package showcase.ui;

import nextjs.raw.react.ReactNode;

typedef CardProps = {
	@:ts.optional
	final ?className:String;
	@:ts.optional
	final ?children:ReactNode;
}

@:jsRequire("@nextjshx/showcase-ui/card", "Card")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native shadcn Card root; the extern adds HXX props without a wrapper. */
extern class Card {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardHeader")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native Card header region with the shared closed Card props. */
extern class CardHeader {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardTitle")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native Card title region with the shared closed Card props. */
extern class CardTitle {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardDescription")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native Card description region with the shared closed Card props. */
extern class CardDescription {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardAction")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native Card action region with the shared closed Card props. */
extern class CardAction {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardContent")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native Card content region with the shared closed Card props. */
extern class CardContent {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardFooter")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
/** Native Card footer region with the shared closed Card props. */
extern class CardFooter {}
