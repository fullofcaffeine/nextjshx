package nextjs.raw.server;

import haxe.extern.EitherType;

/** The only locale literal accepted by a proxy matcher. */
@:ts.type("false")
enum abstract MatcherLocaleDisabled(Bool) to Bool {
	final Disabled = false;
}

/** Condition sources that require a key. */
@:ts.type("'header' | 'query' | 'cookie'")
enum abstract MatcherKeySource(String) to String {
	final Header = "header";
	final Query = "query";
	final Cookie = "cookie";
}

/** Host condition discriminator. */
@:ts.type("'host'")
enum abstract MatcherHostSource(String) to String {
	final Host = "host";
}

typedef MatcherKeyCondition = {
	final type:MatcherKeySource;
	final key:String;
	@:ts.optional
	@:optional var value:String;
}

typedef MatcherHostCondition = {
	final type:MatcherHostSource;
	final value:String;
}

typedef MatcherCondition = EitherType<MatcherKeyCondition, MatcherHostCondition>;

typedef ProxyMatcher = {
	final source:String;
	@:ts.optional
	@:optional var locale:MatcherLocaleDisabled;
	@:ts.optional
	@:optional var has:Array<MatcherCondition>;
	@:ts.optional
	@:optional var missing:Array<MatcherCondition>;
}

typedef MiddlewareConfigFields = {
	@:ts.optional
	@:optional var matcher:EitherType<String, Array<EitherType<String, ProxyMatcher>>>;
	@:ts.optional
	@:optional var regions:EitherType<String, Array<String>>;
	@:ts.optional
	@:optional var unstable_allowDynamic:EitherType<String, Array<String>>;
}

/** Deprecated-name configuration retained for migration compatibility. */
@:ts.type("import('next/server').MiddlewareConfig")
abstract MiddlewareConfig(MiddlewareConfigFields) from MiddlewareConfigFields {}
