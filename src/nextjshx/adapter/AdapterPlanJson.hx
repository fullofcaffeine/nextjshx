package nextjshx.adapter;

import haxe.Json;
import haxe.ds.ReadOnlyArray;
import nextjshx.adapter.AdapterConfig.AdapterConfigValue;

/** Encodes an adapter plan with fixed key order and stable two-space layout. */
class AdapterPlanJson {
	static inline function indent(buffer:StringBuf, depth:Int):Void {
		for (_ in 0...depth) {
			buffer.add("  ");
		}
	}

	static inline function quoted(buffer:StringBuf, value:String):Void {
		buffer.add(Json.stringify(value));
	}

	static function position(buffer:StringBuf, value:AdapterSourcePosition, depth:Int):Void {
		buffer.add("{\n");
		indent(buffer, depth + 1);
		buffer.add('"file": ');
		quoted(buffer, value.file);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"startLine": ${value.startLine},\n');
		indent(buffer, depth + 1);
		buffer.add('"startCharacter": ${value.startCharacter},\n');
		indent(buffer, depth + 1);
		buffer.add('"endLine": ${value.endLine},\n');
		indent(buffer, depth + 1);
		buffer.add('"endCharacter": ${value.endCharacter}\n');
		indent(buffer, depth);
		buffer.add("}");
	}

	static function source(buffer:StringBuf, value:AdapterSource, depth:Int):Void {
		buffer.add("{\n");
		indent(buffer, depth + 1);
		buffer.add('"typeName": ');
		quoted(buffer, value.typeName);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"fieldName": ');
		quoted(buffer, value.fieldName);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"typePosition": ');
		position(buffer, value.typePosition, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"fieldPosition": ');
		position(buffer, value.fieldPosition, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"metadataPosition": ');
		position(buffer, value.metadataPosition, depth + 1);
		buffer.add("\n");
		indent(buffer, depth);
		buffer.add("}");
	}

	static function implementation(buffer:StringBuf, value:AdapterImplementation, depth:Int):Void {
		buffer.add("{\n");
		indent(buffer, depth + 1);
		buffer.add('"modulePath": ');
		quoted(buffer, value.modulePath);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"symbol": ');
		quoted(buffer, value.symbol);
		buffer.add("\n");
		indent(buffer, depth);
		buffer.add("}");
	}

	static function imports(buffer:StringBuf, values:ReadOnlyArray<AdapterImport>, depth:Int):Void {
		buffer.add("[");
		if (values.length > 0) {
			buffer.add("\n");
		}
		for (index in 0...values.length) {
			final value = values[index];
			indent(buffer, depth + 1);
			buffer.add("{\n");
			indent(buffer, depth + 2);
			buffer.add('"modulePath": ');
			quoted(buffer, value.modulePath);
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"symbol": ');
			quoted(buffer, value.symbol);
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"alias": ');
			switch value.alias {
				case null:
					buffer.add("null");
				case alias:
					quoted(buffer, alias);
			}
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"typeOnly": ${value.typeOnly}\n');
			indent(buffer, depth + 1);
			buffer.add("}");
			buffer.add(index == values.length - 1 ? "\n" : ",\n");
		}
		if (values.length > 0) {
			indent(buffer, depth);
		}
		buffer.add("]");
	}

	static function strings(buffer:StringBuf, values:ReadOnlyArray<String>, depth:Int):Void {
		buffer.add("[");
		for (index in 0...values.length) {
			if (index > 0) {
				buffer.add(", ");
			}
			quoted(buffer, values[index]);
		}
		buffer.add("]");
	}

	static function exports(buffer:StringBuf, values:ReadOnlyArray<AdapterExport>, depth:Int):Void {
		buffer.add("[");
		if (values.length > 0) {
			buffer.add("\n");
		}
		for (index in 0...values.length) {
			final value = values[index];
			indent(buffer, depth + 1);
			buffer.add("{\n");
			indent(buffer, depth + 2);
			buffer.add('"kind": ');
			quoted(buffer, value.kind);
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"name": ');
			quoted(buffer, value.name);
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"sourceField": ');
			quoted(buffer, value.sourceField);
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"signature": ');
			quoted(buffer, value.signature);
			buffer.add("\n");
			indent(buffer, depth + 1);
			buffer.add("}");
			buffer.add(index == values.length - 1 ? "\n" : ",\n");
		}
		if (values.length > 0) {
			indent(buffer, depth);
		}
		buffer.add("]");
	}

	static function configValue(buffer:StringBuf, value:AdapterConfigValue, depth:Int):Void {
		buffer.add("{");
		switch value {
			case StringValue(value):
				buffer.add('\n');
				indent(buffer, depth + 1);
				buffer.add('"kind": "string",\n');
				indent(buffer, depth + 1);
				buffer.add('"value": ');
				quoted(buffer, value);
			case IntegerValue(value):
				buffer.add('\n');
				indent(buffer, depth + 1);
				buffer.add('"kind": "integer",\n');
				indent(buffer, depth + 1);
				buffer.add('"value": $value');
			case BooleanValue(value):
				buffer.add('\n');
				indent(buffer, depth + 1);
				buffer.add('"kind": "boolean",\n');
				indent(buffer, depth + 1);
				buffer.add('"value": $value');
			case StringArrayValue(values):
				buffer.add('\n');
				indent(buffer, depth + 1);
				buffer.add('"kind": "string-array",\n');
				indent(buffer, depth + 1);
				buffer.add('"value": ');
				strings(buffer, values, depth + 1);
		}
		buffer.add("\n");
		indent(buffer, depth);
		buffer.add("}");
	}

	static function config(buffer:StringBuf, values:ReadOnlyArray<AdapterConfig>, depth:Int):Void {
		buffer.add("[");
		if (values.length > 0) {
			buffer.add("\n");
		}
		for (index in 0...values.length) {
			final value = values[index];
			indent(buffer, depth + 1);
			buffer.add("{\n");
			indent(buffer, depth + 2);
			buffer.add('"name": ');
			quoted(buffer, value.name);
			buffer.add(",\n");
			indent(buffer, depth + 2);
			buffer.add('"value": ');
			configValue(buffer, value.value, depth + 2);
			buffer.add("\n");
			indent(buffer, depth + 1);
			buffer.add("}");
			buffer.add(index == values.length - 1 ? "\n" : ",\n");
		}
		if (values.length > 0) {
			indent(buffer, depth);
		}
		buffer.add("]");
	}

	static function intent(buffer:StringBuf, value:AdapterIntent, depth:Int):Void {
		buffer.add("{\n");
		indent(buffer, depth + 1);
		buffer.add('"kind": ');
		quoted(buffer, value.kind);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"source": ');
		source(buffer, value.source, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"segmentPath": ');
		quoted(buffer, value.segmentPath);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"targetPath": ');
		quoted(buffer, value.targetPath);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"implementation": ');
		implementation(buffer, value.implementation, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"imports": ');
		imports(buffer, value.imports, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"directives": ');
		strings(buffer, value.directives, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"exports": ');
		exports(buffer, value.exports, depth + 1);
		buffer.add(",\n");
		indent(buffer, depth + 1);
		buffer.add('"config": ');
		config(buffer, value.config, depth + 1);
		buffer.add("\n");
		indent(buffer, depth);
		buffer.add("}");
	}

	public static function encode(plan:AdapterPlan):String {
		final buffer = new StringBuf();
		buffer.add("{\n");
		indent(buffer, 1);
		buffer.add('"$$schema": ');
		quoted(buffer, AdapterPlan.SCHEMA_ID);
		buffer.add(",\n");
		indent(buffer, 1);
		buffer.add('"schemaVersion": ${AdapterPlan.SCHEMA_VERSION},\n');
		indent(buffer, 1);
		buffer.add('"toolchain": {\n');
		indent(buffer, 2);
		buffer.add('"nextjshx": ');
		quoted(buffer, plan.toolchain.nextjshx);
		buffer.add(",\n");
		indent(buffer, 2);
		buffer.add('"haxe": ');
		quoted(buffer, plan.toolchain.haxe);
		buffer.add(",\n");
		indent(buffer, 2);
		buffer.add('"genesTs": ');
		quoted(buffer, plan.toolchain.genesTs);
		buffer.add(",\n");
		indent(buffer, 2);
		buffer.add('"next": ');
		quoted(buffer, plan.toolchain.next);
		buffer.add("\n");
		indent(buffer, 1);
		buffer.add("},\n");
		indent(buffer, 1);
		buffer.add('"intents": [');
		if (plan.intents.length > 0) {
			buffer.add("\n");
		}
		for (index in 0...plan.intents.length) {
			indent(buffer, 2);
			intent(buffer, plan.intents[index], 2);
			buffer.add(index == plan.intents.length - 1 ? "\n" : ",\n");
		}
		if (plan.intents.length > 0) {
			indent(buffer, 1);
		}
		buffer.add("]\n}\n");
		return buffer.toString();
	}
}
