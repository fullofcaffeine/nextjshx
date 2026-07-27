package nextjs.raw.server;

import genes.ts.Unknown;
import haxe.extern.EitherType;
import js.lib.Promise;
import nextjs.raw.server.WebRequest.WebHeadersInit;

/** Common body values accepted by the Web Response constructor. */
@:ts.type("globalThis.BodyInit")
abstract WebResponseBody(EitherType<String,
	EitherType<js.html.Blob,
		EitherType<js.lib.ArrayBuffer,
			EitherType<js.lib.ArrayBufferView, EitherType<WebFormData, WebSearchParams>>>>>) from String from js.html.Blob from js.lib.ArrayBuffer
	from js.lib.ArrayBufferView from WebFormData from WebSearchParams {}

typedef WebResponseInitFields = {
	@:ts.optional
	@:optional var headers:WebHeadersInit;
	@:ts.optional
	@:optional var status:Int;
	@:ts.optional
	@:optional var statusText:String;
}

/** Standard response options with discoverable Haxe fields. */
@:ts.type("globalThis.ResponseInit")
abstract WebResponseInit(WebResponseInitFields) from WebResponseInitFields {}

/**
 * Safe native view of the Web Response contract.
 *
 * This preserves the browser/server runtime object while replacing Haxe's
 * legacy `Dynamic` JSON result with an explicit `genes.ts.Unknown` boundary.
 */
@:native("Response")
@:ts.type("Omit<globalThis.Response, 'json'> & { json(): Promise<unknown> }")
extern class WebResponse {
	static function error():WebResponse;
	static function redirect(url:EitherType<String, js.html.URL>, status:Int = 302):WebResponse;

	final bodyUsed:Bool;
	final headers:js.html.Headers;
	final ok:Bool;
	final redirected:Bool;
	final status:Int;
	final statusText:String;
	final type:js.html.ResponseType;
	final url:String;

	function new(?body:WebResponseBody, ?init:WebResponseInit):Void;
	function arrayBuffer():Promise<js.lib.ArrayBuffer>;
	function blob():Promise<js.html.Blob>;
	function clone():WebResponse;
	function formData():Promise<WebFormData>;
	function json():Promise<Unknown>;
	function text():Promise<String>;
}
