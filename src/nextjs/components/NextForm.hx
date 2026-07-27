package nextjs.components;

/**
 * JSX-safe value binding for Next's enhanced form component.
 *
 * The distinct Haxe name prevents inline markup from confusing the component
 * with the intrinsic HTML `form` tag. `@:jsRequire` still emits the ordinary
 * default import from the public `next/form` entrypoint; no runtime wrapper is
 * introduced.
 */
@:jsRequire("next/form", "default")
@:genes.jsxComponentProps("nextjs.raw.components.Form.FormComponentProps")
extern class NextForm {}
