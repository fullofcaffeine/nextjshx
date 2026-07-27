package server_functions_negative;

import nextjs.server.Authorized;

class BroadOperation {
	public static function misuse(_authorized:Authorized<String, String, String, String>):Void {}
}
