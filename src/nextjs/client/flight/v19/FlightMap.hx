package nextjs.client.flight.v19;

/**
 * NextJsHx compatibility name for Genes' exact React 19 native `Map` view.
 *
 * The reusable extern and its precise `undefined`-aware `get` contract live in
 * Genes so other React hosts can consume the same zero-wrapper capability.
 */
@:genes.compilerInternal
@:genes.semanticOnly
typedef FlightMap<K, V> = genes.react.flight.v19.FlightMap<K, V>;
