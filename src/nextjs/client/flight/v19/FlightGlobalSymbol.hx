package nextjs.client.flight.v19;

/**
 * NextJsHx compatibility name for Genes' React 19 global-registry symbol.
 *
 * Genes owns the canonical `Symbol.for` binding and unforgeable nominal
 * contract; NextJsHx adds no wrapper or runtime behavior.
 */
@:genes.compilerInternal
@:genes.semanticOnly
typedef FlightGlobalSymbol = genes.react.flight.v19.FlightGlobalSymbol;
