package todoapp.input;

import genes.ts.Unknown;
import nextjs.codec.Decode;
import nextjs.codec.DecodeIssueCode;
import nextjs.codec.DecodeResult;
import nextjs.codec.Decoder;
import nextjs.codec.Decoders;
import nextjs.codec.FormDataDecoder;
import nextjs.codec.TextDecoder;
import nextjs.raw.server.WebFormData;
import todoapp.domain.TodoId;
import todoapp.domain.TodoPriority;
import todoapp.mutations.TodoMutationId;

using StringTools;
using nextjs.codec.DecodeResultTools;

typedef TodoDraft = {
	final title:String;
	final note:String;
	final priority:TodoPriority;
}

typedef TodoMutationInput<Payload> = {
	final mutationId:TodoMutationId;
	final payload:Payload;
}

/**
 * Decodes the shared draft shape from untrusted JSON.
 *
 * These codecs are module functions because they own no object or class
 * identity. Forms, actions, and Route Handlers import only the exact decoder
 * they use, matching normal JavaScript/TypeScript schema modules.
 */
function draftJson(value:Unknown, path:String):DecodeResult<TodoDraft> {
	return Decoders.object(value, path, ["note", "priority", "title"], fields -> {
		return fields.required("title", jsonText(120)).flatMap(title -> {
			return fields.required("note", jsonText(240)).flatMap(note -> {
				return fields.required("priority", jsonPriority).map(priority -> {
					return {title: title, note: note, priority: priority};
				});
			});
		});
	});
}

function draftMutationForm(formData:WebFormData):DecodeResult<TodoMutationInput<TodoDraft>> {
	return FormDataDecoder.serverAction(formData, ["mutationId", "title", "note", "priority"], fields -> {
		return fields.required("mutationId", mutationIdText).flatMap(mutationId -> {
			return fields.required("title", safeText(120)).flatMap(title -> {
				return fields.required("note", safeText(240)).flatMap(note -> {
					return fields.required("priority", priorityText).map(priority -> {
						return {mutationId: mutationId, payload: {title: title, note: note, priority: priority}};
					});
				});
			});
		});
	});
}

function idMutationForm(formData:WebFormData):DecodeResult<TodoMutationInput<TodoId>> {
	return FormDataDecoder.serverAction(formData, ["mutationId", "id"], fields -> {
		return fields.required("mutationId", mutationIdText).flatMap(mutationId -> {
			return fields.required("id", todoIdText).map(id -> {mutationId: mutationId, payload: id});
		});
	});
}

/**
 * Decodes an ordered action payload and rejects empty or duplicate IDs.
 *
 * FormData cardinality and reserved Server Action fields are handled by the
 * shared boundary helper; the result is closed before persistence or
 * authorization code can observe it.
 */
function orderMutationForm(formData:WebFormData):DecodeResult<TodoMutationInput<Array<TodoId>>> {
	return FormDataDecoder.serverAction(formData, ["mutationId", "id"], fields -> {
		return fields.required("mutationId", mutationIdText).flatMap(mutationId -> {
			return fields.many("id", todoIdText).flatMap(ids -> {
				if (ids.length == 0) {
					return Decode.reject(DecodeIssueCode.MissingField, "form.id", "at least one ordered todo id is required");
				}
				final seen:Array<String> = [];
				for (index in 0...ids.length) {
					final id:String = ids[index];
					if (seen.indexOf(id) != -1) {
						return Decode.reject(DecodeIssueCode.InvalidValue, 'form.id[$index]', 'todo id "$id" occurs more than once');
					}
					seen.push(id);
				}
				return Decoded({mutationId: mutationId, payload: ids});
			});
		});
	});
}

function jsonText(maximumLength:Int):Decoder<String> {
	return (value, path) -> Decoders.string(value, path).flatMap(text -> safeText(maximumLength)(text, path));
}

function jsonPriority(value:Unknown, path:String):DecodeResult<TodoPriority> {
	return Decoders.string(value, path).flatMap(text -> priorityText(text, path));
}

function safeText(maximumLength:Int):TextDecoder<String> {
	return (value,
		path) -> value == ""
			|| value.trim() != value
			|| value.length > maximumLength
			|| value.indexOf("\t") != -1
			|| value.indexOf("\n") != -1
			|| value.indexOf("\r") != -1 ? Decode.reject(DecodeIssueCode.InvalidValue, path,
				'expected non-empty trimmed single-line text of at most $maximumLength characters') : Decoded(value);
}

function priorityText(value:String, path:String):DecodeResult<TodoPriority> {
	final priority = TodoPriority.parse(value);
	return priority == null ? Decode.reject(DecodeIssueCode.InvalidValue, path, "expected exactly P0, P1, or P2") : Decode.accept(priority);
}

function todoIdText(value:String, path:String):DecodeResult<TodoId> {
	final id = TodoId.parse(value);
	return id == null ? Decode.reject(DecodeIssueCode.InvalidValue, path, "expected a lowercase URL-safe todo id") : Decoded(id);
}

function mutationIdText(value:String, path:String):DecodeResult<TodoMutationId> {
	final id = TodoMutationId.parse(value);
	return id == null ? Decode.reject(DecodeIssueCode.InvalidValue, path, "expected a bounded mutation replay id") : Decoded(id);
}
