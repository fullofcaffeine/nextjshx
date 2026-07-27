package nextjs.client.flight.v19;

/**
 * React 19 Flight set whose elements are checked recursively.
 *
 * The typedef deliberately keeps the native JavaScript `Set` identity and
 * adds no conversion, helper, or runtime allocation.
 */
typedef FlightSet<T> = js.lib.Set<T>;
