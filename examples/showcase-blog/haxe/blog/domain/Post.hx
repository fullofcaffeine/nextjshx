package blog.domain;

/** Stable route value shared by the catalogue, metadata, and typed hrefs. */
abstract PostSlug(String) from String to String {}

enum abstract PostKind(String) to String {
	final FieldNote = "Field note";
	final Stewardship = "Stewardship";
	final TrailCraft = "Trail craft";
}

/** Deterministic editorial record; no CMS or untyped payload is involved. */
typedef Post = {
	final slug:PostSlug;
	final kind:PostKind;
	final issue:String;
	final title:String;
	final dek:String;
	final excerpt:String;
	final published:String;
	final minutes:Int;
	final location:String;
	final coordinates:String;
	final elevation:String;
	final paragraphs:Array<String>;
}
