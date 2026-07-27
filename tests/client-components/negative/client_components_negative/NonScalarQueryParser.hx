package client_components_negative;

import nextjs.integrations.nuqs.Nuqs;
import nextjs.raw.integrations.nuqs.QueryParser;

private typedef QueryRecord = {
	final id:String;
}

private extern class QueryRecordParser {
	@:jsRequire("query-record-parser", "parser")
	static final parser:QueryParser<QueryRecord>;
}

/** Arbitrary object parsers stay available only through the faithful raw API. */
class NonScalarQueryParser {
	@:next.hook
	public static function useInvalid():Void {
		Nuqs.useQueryState("record", QueryRecordParser.parser);
	}
}
