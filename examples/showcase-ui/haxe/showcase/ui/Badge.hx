package showcase.ui;

import genes.react.Element;
import nextjs.raw.react.ReactNode;

enum abstract BadgeVariant(String) to String {
	final Default = "default";
	final Secondary = "secondary";
	final Destructive = "destructive";
	final Outline = "outline";
}

typedef BadgeAppearanceProps = {
	@:ts.optional
	final ?variant:BadgeVariant;
	@:ts.optional
	final ?className:String;
}

typedef BadgeProps = {
	> BadgeAppearanceProps,
	@:ts.optional
	final ?children:ReactNode;
}

/** Checked one-element view of the source-owned Badge's Radix asChild mode. */
typedef SlottedBadgeProps = {
	> BadgeAppearanceProps,
	final asChild:Bool;
	final children:Element;
}

/**
 * Source-owned shadcn Badge for ordinary renderable content.
 *
 * The import and JSX-props annotations bind directly to the named native
 * export and make HXX validate `BadgeProps`; they add no runtime adapter.
 */
@:jsRequire("@nextjshx/showcase-ui/badge", "Badge")
@:genes.jsxComponentProps("showcase.ui.Badge.BadgeProps")
extern class Badge {}

/**
 * Exact-child `asChild` view of the same native Badge export.
 *
 * Requiring one `Element` catches the ordinary Radix Slot failure modes in
 * Haxe. `@:jsRequire` still emits the normal `<Badge asChild>` component, so
 * this stronger authoring identity has no wrapper or allocation at runtime.
 */
@:jsRequire("@nextjshx/showcase-ui/badge", "Badge")
@:genes.jsxComponentProps("showcase.ui.Badge.SlottedBadgeProps")
extern class SlottedBadge {}
