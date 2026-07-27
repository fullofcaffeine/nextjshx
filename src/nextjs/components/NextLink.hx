package nextjs.components;

import nextjs.raw.components.LinkProps.LinkPropsFields;
import nextjs.route.SameZoneHref;

@:genes.compilerInternal
@:genes.semanticOnly
typedef NextLinkComponentProps = LinkPropsFields<SameZoneHref>;

/**
 * JSX-safe value binding for Next's client-side navigation component.
 *
 * The distinct Haxe name prevents inline markup from confusing the component
 * with the intrinsic HTML `link` tag. `@:jsRequire` still emits the ordinary
 * default import from the public `next/link` entrypoint; no runtime wrapper is
 * introduced.
 */
@:jsRequire("next/link", "default")
@:genes.jsxComponentProps("nextjs.components.NextLink.NextLinkComponentProps")
extern class NextLink {}
