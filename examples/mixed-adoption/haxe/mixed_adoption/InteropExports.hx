package mixed_adoption;

/**
 * An ordinary Haxe function consumed from native TypeScript.
 *
 * `@:expose` makes the external DCE root explicit and emits one named ESM
 * export. No React adapter or wrapper is needed for a plain function.
 */
@:expose
function haxeInteropLabel(channel:String):String {
	return channel.toUpperCase() + " / VERIFIED BY HAXE";
}
