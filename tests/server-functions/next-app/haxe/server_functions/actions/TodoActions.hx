package server_functions.actions;

import js.lib.Promise;
import nextjs.codec.Decode;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.codec.FormDataDecoder;
import nextjs.codec.TextDecoders;
import nextjs.raw.server.WebFormData;
import nextjs.server.GuardRejection;
import nextjs.server.GuardedAction;
import server_functions.security.GuardedTodoPolicy;
import server_functions.security.GuardedTodoService;
import server_functions.security.GuardedTodoTypes.SaveDomainChange;
import server_functions.security.GuardedTodoTypes.SaveTodoInput;
import server_functions.security.GuardedTodoTypes.SaveTodoOperation;

using nextjs.codec.DecodeResultTools;

typedef TodoDraft = {
	final title:String;
	final priority:Int;
}

typedef TodoReceipt = {
	final title:String;
	final accepted:Bool;
}

/** Native actions with a typed guarded path for the sensitive mutation. */
@:next.serverFunctions("actions/todos")
class TodoActions {
	@:next.action
	@:async
	public static function save(formData:WebFormData):Promise<Void> {
		return GuardedAction.run({
			operation: SaveTodoOperation.current,
			decode: () -> decodeSave(formData),
			authenticate: GuardedTodoPolicy.currentActor,
			resolve: GuardedTodoPolicy.resolve,
			authorize: GuardedTodoPolicy.authorize,
			execute: GuardedTodoService.save,
			expose: hideDomainResult,
			reject: hideGuardRejection
		});
	}

	/** Closed-record argument/result evidence independent of FormData. */
	@:next.action
	@:async
	public static function summarize(draft:TodoDraft):Promise<TodoReceipt> {
		return {title: draft.title, accepted: draft.priority > 0};
	}

	static function decodeSave(formData:WebFormData):DecodeResult<SaveTodoInput> {
		return FormDataDecoder.serverAction(formData, ["expectedVersion", "title", "workspaceId"], fields -> {
			return fields.required("title", TextDecoders.nonEmpty(80)).flatMap(title -> {
				return fields.required("workspaceId", TextDecoders.oneOf(["workspace-a", "workspace-b"])).flatMap(workspaceId -> {
					return fields.required("expectedVersion", positiveVersion).map(expectedVersion -> {
						return {title: title, workspaceId: workspaceId, expectedVersion: expectedVersion};
					});
				});
			});
		});
	}

	static function positiveVersion(value:String, path:String):DecodeResult<Int> {
		return TextDecoders.int32(value, path)
			.flatMap(version -> version < 1 ? Decode.reject(DecodeIssueCode.InvalidValue, path, "expected a positive resource version") : Decoded(version));
	}

	static function hideDomainResult(_change:SaveDomainChange):Void {}

	static function hideGuardRejection(_rejection:GuardRejection):Void {}
}
