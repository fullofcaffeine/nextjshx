package nextjs.client.flight.v19;

/**
 * React 19 Flight value whose runtime representation is the native JavaScript
 * `Date` object.
 *
 * The versioned name is intentional: it records which React Flight contract
 * admitted the value while the typedef preserves the exact zero-wrapper
 * `Date` representation in generated TypeScript and JavaScript.
 */
typedef FlightDate = js.lib.Date;
