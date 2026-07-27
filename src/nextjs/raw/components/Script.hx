package nextjs.raw.components;

import nextjs.raw.react.ReactNode;
import nextjs.raw.components.ScriptProps.ScriptStrategy;

/**
 * HXX-safe projection of Next Script properties.
 *
 * The upstream load/error payload is `any`; HXX therefore exposes callbacks
 * that safely ignore that payload. `ScriptProps` remains the faithful raw
 * object contract when an application deliberately decodes the host event.
 */
@:genes.compilerInternal
@:genes.semanticOnly
typedef ScriptComponentProps = {
	@:optional var src:String;
	@:optional var strategy:ScriptStrategy;
	@:optional var id:String;
	@:optional var onLoad:Void->Void;
	@:optional var onReady:Void->Void;
	@:optional var onError:Void->Void;
	@:optional var children:ReactNode;
	@:optional var stylesheets:Array<String>;
	@:optional var type:String;
	@:optional var nonce:String;
}

/** Faithful default-import component binding for `next/script`. */
@:jsRequire("next/script", "default")
@:genes.jsxComponentProps("nextjs.raw.components.Script.ScriptComponentProps")
extern class Script {}
