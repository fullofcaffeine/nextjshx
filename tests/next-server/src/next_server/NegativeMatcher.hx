package next_server;

import nextjs.raw.server.MiddlewareConfig.MatcherHostCondition;
import nextjs.raw.server.MiddlewareConfig.MatcherHostSource;

class NegativeMatcher {
	static function main():Void {
		final matcher:MatcherHostCondition = {type: MatcherHostSource.Host};
		consume(matcher);
	}

	static function consume<T>(_:T):Void {}
}
