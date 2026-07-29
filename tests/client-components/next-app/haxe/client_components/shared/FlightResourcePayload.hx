package client_components.shared;

/**
 * Closed Promise result shared across the React Flight boundary.
 *
 * Keeping the resolved value as a closed plain record lets Genes validate
 * every nested field before NextJsHx admits the server-owned FlightPromise.
 * The type proves transport shape only; it does not validate external input or
 * authorize access to the represented data.
 */
typedef FlightResourcePayload = {
	final message:String;
	final sequence:Int;
}
