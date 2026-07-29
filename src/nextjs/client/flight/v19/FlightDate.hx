package nextjs.client.flight.v19;

/**
 * React 19 Flight value whose runtime representation is the native JavaScript
 * `Date` object.
 *
 * The reusable zero-wrapper contract lives in Genes; this alias preserves the
 * established NextJsHx source name for application compatibility.
 */
@:genes.compilerInternal
@:genes.semanticOnly
typedef FlightDate = genes.react.flight.v19.FlightDate;
