package commerce.domain;

/** Stable product-route key retained by typed Haxe href generation. */
abstract ProductSlug(String) from String to String {}

/** Integer minor-unit money prevents floating-point display drift. */
abstract Money(Int) from Int to Int {
	public inline function cents():Int {
		return this;
	}

	public inline function label():String {
		final dollars = Std.int(this / 100);
		final cents = this % 100;
		return "$" + dollars + "." + (cents < 10 ? "0" : "") + cents;
	}
}

enum abstract ProductCategory(String) to String {
	final System = "systems";
	final Tool = "tools";
}

typedef Product = {
	final slug:ProductSlug;
	final name:String;
	final edition:String;
	final category:ProductCategory;
	final price:Money;
	final tagline:String;
	final description:String;
	final image:String;
	final alt:String;
	final footprint:String;
	final light:String;
	final harvest:String;
	final includes:Array<String>;
}
