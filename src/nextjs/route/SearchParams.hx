package nextjs.route;

import genes.ts.Undefinable;
import haxe.DynamicAccess;
import haxe.extern.EitherType;

/** One raw value supplied through an App Router page's search parameters. */
@:ts.type("string | string[] | undefined")
typedef SearchParamValue = Undefinable<EitherType<String, Array<String>>>;

/**
 * Faithful raw App Router search-parameter record.
 *
 * Typed query decoding is intentionally a separate semantic layer. Keeping
 * this boundary exact prevents a page declaration from pretending that
 * external URL input is already a validated domain value. Indexed reads are
 * available in Haxe, while mutation APIs are deliberately absent because
 * Next owns this input record.
 */
@:ts.type("Readonly<Record<string, string | string[] | undefined>>")
abstract SearchParams(DynamicAccess<SearchParamValue>) {
	@:arrayAccess
	public inline function get(name:String):Null<SearchParamValue> {
		return this.get(name);
	}
}
