package nextjs.raw.components;

import haxe.extern.EitherType;
import nextjs.raw.react.ReactNode;

/** Public URL-object alternative accepted by Next Link. */
@:ts.type("Exclude<import('next/link').LinkProps<unknown>['href'], string>")
typedef LinkUrlObject = {
	@:optional var protocol:String;
	@:optional var hostname:String;
	@:optional var port:EitherType<String, Int>;
	@:optional var pathname:String;
	@:optional var query:EitherType<String, haxe.DynamicAccess<EitherType<String, Array<String>>>>;
	@:optional var hash:String;
}

/** Closed automatic-prefetch literal. */
@:ts.type("'auto'")
enum abstract LinkPrefetchMode(String) to String {
	final Auto = "auto";
}

/** The only Boolean literal that disables locale prefixing. */
@:ts.type("false")
enum abstract LinkLocaleDisabled(Bool) to Bool {
	final Disabled = false;
}

/** Navigation event supplied after Next has resolved a client transition. */
typedef LinkNavigateEvent = {
	final preventDefault:Void->Void;
}

typedef LinkPropsFields<RouteInfer> = {
	final href:EitherType<RouteInfer, LinkUrlObject>;
	@:optional var as:EitherType<RouteInfer, LinkUrlObject>;
	@:optional var replace:Bool;
	@:optional var scroll:Bool;
	@:optional var shallow:Bool;
	@:optional var passHref:Bool;
	@:optional var prefetch:Null<EitherType<Bool, LinkPrefetchMode>>;
	@:optional var locale:EitherType<String, LinkLocaleDisabled>;
	@:optional var legacyBehavior:Bool;
	@:optional var onNavigate:LinkNavigateEvent->Void;
	@:optional var transitionTypes:Array<String>;
	@:optional var children:ReactNode;
	@:optional var className:String;
	@:optional var id:String;
}

/**
 * Next Link's public routing props with a Haxe-visible href parameter.
 *
 * Use `String` for the faithful raw fallback or a generated RouteHref type to
 * reject unrelated routes before TypeScript emission.
 */
@:ts.type("import('next/link').LinkProps<$0>")
@:forward
abstract LinkProps<RouteInfer>(LinkPropsFields<RouteInfer>) from LinkPropsFields<RouteInfer> {}
