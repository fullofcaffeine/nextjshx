package nextjs.server;

/** Result of validating the current request's server-derived identity. */
enum Authentication<Actor> {
	Authenticated(actor:Actor);
	Unauthenticated;
}
