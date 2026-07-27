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
extern class Card {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardHeader")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
extern class CardHeader {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardTitle")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
extern class CardTitle {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardDescription")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
extern class CardDescription {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardAction")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
extern class CardAction {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardContent")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
extern class CardContent {}

@:jsRequire("@nextjshx/showcase-ui/card", "CardFooter")
@:genes.jsxComponentProps("showcase.ui.Card.CardProps")
extern class CardFooter {}
