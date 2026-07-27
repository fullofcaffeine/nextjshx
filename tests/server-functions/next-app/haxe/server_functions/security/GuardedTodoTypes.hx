package server_functions.security;

import nextjs.server.ActionOperation;

typedef GuardedActor = {
	final id:String;
	final tenant:String;
}

typedef SaveTodoInput = {
	final title:String;
	final workspaceId:String;
	final expectedVersion:Int;
}

typedef WorkspaceTarget = {
	final id:String;
	final tenant:String;
	final ownerId:String;
	final version:Int;
}

typedef SaveDomainChange = {
	final title:String;
	final version:Int;
	final auditSecret:String;
}

/** Nominal marker that keeps a save witness distinct from other operations. */
@:next.serverOnly
class SaveTodoOperation implements ActionOperation {
	public static final current = new SaveTodoOperation();

	private function new() {}
}
