package server_functions.client;

import genes.react.Element;
import nextjs.server.ServerFunction;
import server_functions.actions.TodoActions;

typedef TodoActionFormProps = {
	final workspaceId:String;
	final expectedVersion:Int;
}

/** Client boundary that imports only the generated native action ref. */
@:next.clientComponent("components/TodoActionForm")
class TodoActionForm {
	public static function render(_props:TodoActionFormProps):Element {
		final save = ServerFunction.ref(TodoActions.save);
		return <form id="todo-action-form" action={save} style={{display: "grid", gap: "0.8rem"}}>
			<input id={"todo-action-workspace"} type={"hidden"} name={"workspaceId"} value={_props.workspaceId} />
			<input id={"todo-action-version"} type={"hidden"} name={"expectedVersion"} value={_props.expectedVersion} />
			<label htmlFor={"todo-action-title"}>Title</label>
			<input id={"todo-action-title"} name={"title"} required={true} maxLength={80} />
			<button id={"todo-action-submit"} type={"submit"}>Save through Haxe</button>
		</form>;
	}
}
