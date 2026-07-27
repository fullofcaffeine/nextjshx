package todoapp.domain;

/** Immutable server-rendered todo projection used by list and detail routes. */
typedef Todo = {
	final id:TodoId;
	final completed:Bool;
	final priority:TodoPriority;
	final title:String;
	final note:String;
}
