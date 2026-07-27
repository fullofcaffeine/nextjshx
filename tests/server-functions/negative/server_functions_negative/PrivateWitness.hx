package server_functions_negative;

import nextjs.server.Authorized;
import nextjs.server.ActionOperation;

class PrivateOperation implements ActionOperation {}

class PrivateWitness {
	public static function forge(operation:PrivateOperation):Authorized<PrivateOperation, String, String, String> {
		return new Authorized(operation, "actor", "workspace", "input");
	}
}
