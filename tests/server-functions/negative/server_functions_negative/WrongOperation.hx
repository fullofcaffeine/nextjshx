package server_functions_negative;

import nextjs.server.Authorized;
import nextjs.server.ActionOperation;

class CreateOperation implements ActionOperation {}
class RemoveOperation implements ActionOperation {}

class WrongOperation {
	static function remove(_authorized:Authorized<RemoveOperation, String, String, String>):Void {}

	public static function misuse(authorized:Authorized<CreateOperation, String, String, String>):Void {
		remove(authorized);
	}
}
