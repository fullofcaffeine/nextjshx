package nextjs.raw.components;

import haxe.extern.EitherType;
import nextjs.raw.react.ReactNode;
import nextjs.raw.server.WebFormData;

/** Synchronous React form action. */
typedef SyncFormAction = WebFormData->Void;

/** Asynchronous React form action. */
typedef AsyncFormAction = WebFormData->js.lib.Promise<Void>;

/** The only explicit prefetch value supported by Next Form. */
@:ts.type("false")
enum abstract FormPrefetch(Bool) to Bool {
	final Disabled = false;
}

typedef FormPropsFields<RouteInfer> = {
	final action:EitherType<RouteInfer, EitherType<SyncFormAction, AsyncFormAction>>;
	@:optional var prefetch:Null<FormPrefetch>;
	@:optional var replace:Bool;
	@:optional var scroll:Bool;
	@:optional var children:ReactNode;
	@:optional var className:String;
	@:optional var id:String;
	@:optional var name:String;
}

/**
 * Next Form props with a Haxe-visible route/action union.
 *
 * The deliberately absent `method`, `encType`, and `target` fields mirror
 * Next's own public exclusion instead of accepting values it will ignore.
 */
@:ts.type("import('next/form').FormProps<$0>")
@:forward
abstract FormProps<RouteInfer>(FormPropsFields<RouteInfer>) from FormPropsFields<RouteInfer> {}
