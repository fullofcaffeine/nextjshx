package nextjs.components;

/**
 * JSX-safe value binding for Next's optimized script component.
 *
 * The distinct Haxe name prevents inline markup from confusing the component
 * with the intrinsic HTML `script` tag. `@:jsRequire` still emits the ordinary
 * default import from the public `next/script` entrypoint; no runtime wrapper
 * is introduced.
 */
@:jsRequire("next/script", "default")
@:genes.jsxComponentProps("nextjs.raw.components.Script.ScriptComponentProps")
extern class NextScript {}
