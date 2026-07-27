package nextjs.components;

/**
 * JSX-safe value binding for Next's optimized image component.
 *
 * The distinct Haxe name prevents inline markup from confusing the component
 * with an intrinsic image tag. `@:jsRequire` still emits the ordinary default
 * import from the public `next/image` entrypoint; no runtime wrapper exists.
 */
@:jsRequire("next/image", "default")
@:genes.jsxComponentProps("nextjs.raw.components.ImageProps.ImagePropsFields")
extern class NextImage {}
