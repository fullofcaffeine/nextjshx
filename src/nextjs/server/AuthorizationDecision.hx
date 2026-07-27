package nextjs.server;

/** Closed application policy decision for one actor, target, and operation. */
enum AuthorizationDecision {
	Allowed;
	Denied;
}
