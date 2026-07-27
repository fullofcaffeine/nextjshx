package nextjs.app;

/** Stable runtimes accepted by the semantic segment-config layer. */
enum abstract SegmentRuntime(String) to String {
	final NodeJs = "nodejs";
	final Edge = "edge";
}
