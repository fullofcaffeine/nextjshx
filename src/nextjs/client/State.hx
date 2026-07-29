package nextjs.client;

/**
 * Compatibility name for Genes' framework-neutral semantic React state.
 *
 * The behavior lives in `genes.react` because it depends only on React's state
 * contract and is reusable by Gutenberg or any other React host; NextJsHx
 * retains this typedef for source compatibility.
 *
 * The underlying abstract remains allocation-free and erases to React's
 * existing tuple. New framework-neutral modules may import
 * `genes.react.State` directly; NextJsHx applications may keep this name.
 */
typedef State<Value> = genes.react.State<Value>;
