package adapter_plan;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type.ClassField;
import haxe.macro.Type.ClassType;
import nextjshx.adapter.AdapterConfig;
import nextjshx.adapter.AdapterConfig.AdapterConfigValue;
import nextjshx.adapter.AdapterExport;
import nextjshx.adapter.AdapterExport.AdapterExportKind;
import nextjshx.adapter.AdapterImplementation;
import nextjshx.adapter.AdapterImport;
import nextjshx.adapter.AdapterKind;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.adapter.AdapterPlanRegistry.AdapterIntentRegistration;

class PlanFixture {
	static function requireClass(typeName:String):ClassType {
		return switch Context.getType(typeName) {
			case TInst(reference, _):
				reference.get();
			case _:
				Context.fatalError('Adapter-plan fixture type "$typeName" is not a class.', Context.currentPos());
		};
	}

	static function requireStaticField(type:ClassType, name:String):ClassField {
		for (field in type.statics.get()) {
			if (field.name == name) {
				return field;
			}
		}
		return Context.fatalError('Adapter-plan fixture field "${type.name}.$name" is missing.', type.pos);
	}

	static function requireMetadataPosition(type:ClassType):Position {
		for (entry in type.meta.get()) {
			if (entry.name == ":adapterPlanFixture") {
				return entry.pos;
			}
		}
		return Context.fatalError('Adapter-plan fixture metadata is missing from "${type.name}".', type.pos);
	}

	static function sourceTypeName(type:ClassType):String {
		return type.pack.concat([type.name]).join(".");
	}

	static function pageRegistration(type:ClassType):AdapterIntentRegistration {
		final render = requireStaticField(type, "render");
		return {
			kind: AdapterKind.Page,
			sourceType: sourceTypeName(type),
			sourceField: render.name,
			typePosition: type.pos,
			fieldPosition: render.pos,
			metadataPosition: requireMetadataPosition(type),
			segmentPath: "todos/[id]",
			targetPath: "todos/[id]/page.tsx",
			implementation: new AdapterImplementation("../../../../src-gen/adapter_plan/PageDeclaration", "PageDeclaration"),
			imports: [
				new AdapterImport("next", "PageProps", "RoutePageProps", true),
				new AdapterImport("../../../../src-gen/adapter_plan/PageDeclaration", "PageDeclaration")
			],
			directives: [],
			exports: [
				new AdapterExport(AdapterExportKind.Default, "default", "render", '(props: PageProps<"/todos/[id]">) => ReactNode')
			],
			config: [
				new AdapterConfig("runtime", AdapterConfigValue.StringValue("nodejs")),
				new AdapterConfig("revalidate", AdapterConfigValue.IntegerValue(60)),
				new AdapterConfig("preferredRegion", AdapterConfigValue.StringArrayValue(["iad1", "sfo1"])),
				new AdapterConfig("dynamicParams", AdapterConfigValue.BooleanValue(true))
			]
		};
	}

	static function clientRegistration(type:ClassType, duplicateTarget:Bool):AdapterIntentRegistration {
		final render = requireStaticField(type, "render");
		return {
			kind: duplicateTarget ? AdapterKind.Page : AdapterKind.ClientComponent,
			sourceType: sourceTypeName(type),
			sourceField: render.name,
			typePosition: type.pos,
			fieldPosition: render.pos,
			metadataPosition: requireMetadataPosition(type),
			segmentPath: duplicateTarget ? "todos/[id]" : "todos/_components/TodoToggle",
			targetPath: duplicateTarget ? "todos/[id]/page.tsx" : "todos/_components/TodoToggle.tsx",
			implementation: new AdapterImplementation("../../../src-gen/adapter_plan/ClientDeclaration", "ClientDeclaration"),
			imports: [
				new AdapterImport("react", "ComponentType", null, true),
				new AdapterImport("../../../src-gen/adapter_plan/ClientDeclaration", "ClientDeclaration")
			],
			directives: ["use client", "use strict"],
			exports: [
				new AdapterExport(AdapterExportKind.Default, "default", "render", "ComponentType<ClientProps>")
			],
			config: []
		};
	}

	public static macro function emit(outputPath:String, order:String):Expr {
		AdapterPlanRegistry.install(outputPath, "0.0.0-development", "4.3.7", "1.41.0+1ead794285d4f43cbbc96078d4eac4a4d8bf6cce", "16.2.12");

		final page = pageRegistration(requireClass("adapter_plan.PageDeclaration"));
		final client = clientRegistration(requireClass("adapter_plan.ClientDeclaration"), order == "duplicate");
		final registrations = switch order {
			case "forward": [page, client];
			case "reverse" | "duplicate": [client, page];
			case _:
				Context.fatalError('Unknown adapter-plan fixture order "$order".', Context.currentPos());
		};
		for (registration in registrations) {
			AdapterPlanRegistry.register(registration);
		}
		return macro null;
	}
}
#end
