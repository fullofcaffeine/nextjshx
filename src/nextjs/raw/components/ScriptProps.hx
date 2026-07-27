package nextjs.raw.components;

import genes.ts.Unknown;
import nextjs.raw.react.ReactNode;

/** Script loading phase supported by the public Next component. */
@:ts.type("'afterInteractive' | 'lazyOnload' | 'beforeInteractive' | 'worker'")
enum abstract ScriptStrategy(String) to String {
	final AfterInteractive = "afterInteractive";
	final LazyOnload = "lazyOnload";
	final BeforeInteractive = "beforeInteractive";
	final Worker = "worker";
}

typedef ScriptPropsFields = {
	@:optional var src:String;
	@:optional var strategy:ScriptStrategy;
	@:optional var id:String;
	@:optional var onLoad:Unknown->Void;
	@:optional var onReady:Void->Void;
	@:optional var onError:Unknown->Void;
	@:optional var children:ReactNode;
	@:optional var stylesheets:Array<String>;
	@:optional var type:String;
	@:optional var nonce:String;
}

/**
 * Public Next Script props with callback payload uncertainty made explicit.
 */
@:ts.type("Omit<import('next/script').ScriptProps, 'onLoad' | 'onError'> & { onLoad?: (event: unknown) => void; onError?: (event: unknown) => void }")
typedef ScriptProps = ScriptPropsFields;
