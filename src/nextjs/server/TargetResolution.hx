package nextjs.server;

/** Authenticated lookup of the exact resource or parent authorization scope. */
enum TargetResolution<Target> {
	Resolved(target:Target);
	Missing;
}
