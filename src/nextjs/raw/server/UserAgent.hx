package nextjs.raw.server;

typedef UserAgentBrowser = {
	@:ts.optional
	@:optional var name:String;
	@:ts.optional
	@:optional var version:String;
	@:ts.optional
	@:optional var major:String;
}

typedef UserAgentDevice = {
	@:ts.optional
	@:optional var model:String;
	@:ts.optional
	@:optional var type:String;
	@:ts.optional
	@:optional var vendor:String;
}

typedef UserAgentEngine = {
	@:ts.optional
	@:optional var name:String;
	@:ts.optional
	@:optional var version:String;
}

typedef UserAgentOperatingSystem = {
	@:ts.optional
	@:optional var name:String;
	@:ts.optional
	@:optional var version:String;
}

typedef UserAgentCpu = {
	@:ts.optional
	@:optional var architecture:String;
}

/** Parsed user-agent information returned by Next's public helpers. */
@:ts.type("ReturnType<typeof import('next/server').userAgent>")
typedef UserAgent = {
	final isBot:Bool;
	final ua:String;
	final browser:UserAgentBrowser;
	final device:UserAgentDevice;
	final engine:UserAgentEngine;
	final os:UserAgentOperatingSystem;
	final cpu:UserAgentCpu;
}
