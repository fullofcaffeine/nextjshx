package nextjs.client;

/**
 * Compatibility name for Genes' framework-neutral optimistic React state.
 *
 * The behavior lives in `genes.react` because it depends only on React's
 * `useOptimistic` contract and is reusable by Gutenberg or any other React
 * host; NextJsHx retains this typedef for source compatibility.
 *
 * The underlying abstract remains allocation-free and erases to React's
 * existing tuple.
 */
typedef Optimistic<State, Action> = genes.react.Optimistic<State, Action>;
