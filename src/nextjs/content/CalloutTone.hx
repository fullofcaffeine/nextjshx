package nextjs.content;

/** Closed visual intent shared by content sources and renderers. */
enum abstract CalloutTone(String) to String {
	final Note = "note";
	final Insight = "insight";
	final Caution = "caution";
}
