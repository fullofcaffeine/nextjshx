package nextjshx.client;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import haxe.macro.Type;
import haxe.macro.Type.ClassField;
import haxe.macro.Type.ClassType;
import haxe.macro.Type.FieldAccess;

using Lambda;
using haxe.macro.TypeTools;

private enum ReactFunctionKind {
	OrdinaryFunction;
	ClientComponent;
	CustomHook;
}

private enum ReactCallKind {
	ReviewedHook(owner:ClassType, field:ClassField);
	ReactUse(owner:ClassType, field:ClassField);
	KnownImpure(label:String);
}

private typedef ReactPlacement = {
	final functionKind:ReactFunctionKind;
	final conditional:Bool;
	final loop:Bool;
	final nestedFunction:Bool;
	final protectedBlock:Bool;
	final afterEarlyReturn:Bool;
}

private typedef ReturnFlow = {
	final mayReturn:Bool;
	final alwaysReturns:Bool;
}
#end

/**
 * Audits locally provable React Hook placement and render-purity mistakes.
 *
 * Calls are classified from typed field identity and reviewed metadata. Names
 * alone never turn an ordinary Haxe function into a Hook.
 */
class ReactDiagnosticsMacro {
	#if macro
	static inline final HOOK_METADATA = ":next.hook";
	static inline final REACT_USE_METADATA = ":next.reactUse";
	static final NO_RETURN:ReturnFlow = {mayReturn: false, alwaysReturns: false};
	static var installed:Bool = false;

	static function fail<T>(code:String, message:String, position:Position):T {
		return Context.fatalError('[$code] $message', position);
	}

	static function fullTypeName(type:ClassType):String {
		final primaryTypeName = type.pack.concat([type.name]).join(".");
		return type.module == primaryTypeName ? primaryTypeName : '${type.module}.${type.name}';
	}

	static function fieldLabel(owner:ClassType, field:ClassField):String {
		if (owner.module == "nextjshx.client.ReactHookBindings" && owner.name == "ReactHookBindings") {
			return switch field.name {
				case "use": "nextjs.client.React.use";
				case "useStateValue": "nextjs.client.React.useState";
				case "useStateLazy": "nextjs.client.React.useStateLazy";
				case "useMemo": "nextjs.client.React.useMemo";
				case _: '${fullTypeName(owner)}.${field.name}';
			};
		}
		return '${fullTypeName(owner)}.${field.name}';
	}

	static function placement(functionKind:ReactFunctionKind):ReactPlacement {
		return {
			functionKind: functionKind,
			conditional: false,
			loop: false,
			nestedFunction: false,
			protectedBlock: false,
			afterEarlyReturn: false
		};
	}

	static function withConditional(value:ReactPlacement):ReactPlacement {
		return {
			functionKind: value.functionKind,
			conditional: true,
			loop: value.loop,
			nestedFunction: value.nestedFunction,
			protectedBlock: value.protectedBlock,
			afterEarlyReturn: value.afterEarlyReturn
		};
	}

	static function withLoop(value:ReactPlacement):ReactPlacement {
		return {
			functionKind: value.functionKind,
			conditional: value.conditional,
			loop: true,
			nestedFunction: value.nestedFunction,
			protectedBlock: value.protectedBlock,
			afterEarlyReturn: value.afterEarlyReturn
		};
	}

	static function withNestedFunction(value:ReactPlacement):ReactPlacement {
		return {
			functionKind: value.functionKind,
			conditional: value.conditional,
			loop: value.loop,
			nestedFunction: true,
			protectedBlock: value.protectedBlock,
			afterEarlyReturn: false
		};
	}

	static function withProtectedBlock(value:ReactPlacement):ReactPlacement {
		return {
			functionKind: value.functionKind,
			conditional: value.conditional,
			loop: value.loop,
			nestedFunction: value.nestedFunction,
			protectedBlock: true,
			afterEarlyReturn: value.afterEarlyReturn
		};
	}

	static function withEarlyReturn(value:ReactPlacement):ReactPlacement {
		return {
			functionKind: value.functionKind,
			conditional: value.conditional,
			loop: value.loop,
			nestedFunction: value.nestedFunction,
			protectedBlock: value.protectedBlock,
			afterEarlyReturn: true
		};
	}

	static function mergeFlows(values:Array<ReturnFlow>):ReturnFlow {
		return {
			mayReturn: values.exists(value -> value.mayReturn),
			alwaysReturns: values.length > 0 && values.foreach(value -> value.alwaysReturns)
		};
	}

	static function fieldAccess(value:FieldAccess):Null<{final owner:ClassType; final field:ClassField;}> {
		return switch value {
			case FInstance(owner, _, field) | FStatic(owner, field):
				{owner: owner.get(), field: field.get()};
			case FClosure(owner, field) if (owner != null):
				{owner: owner.c.get(), field: field.get()};
			case _:
				null;
		};
	}

	static function unwrapCallee(expression:TypedExpr):TypedExpr {
		return switch expression.expr {
			case TParenthesis(inner) | TCast(inner, _) | TMeta(_, inner): unwrapCallee(inner);
			case _: expression;
		};
	}

	static function callKind(callee:TypedExpr):Null<ReactCallKind> {
		final expression = unwrapCallee(callee);
		return switch expression.expr {
			case TField(_, access):
				final resolved = fieldAccess(access);
				if (resolved == null) {
					null;
				} else if (resolved.field.meta.has(REACT_USE_METADATA)) {
					ReactUse(resolved.owner, resolved.field);
				} else if (resolved.field.meta.has(HOOK_METADATA)) {
					ReviewedHook(resolved.owner, resolved.field);
				} else if (resolved.owner.module == "Math" && resolved.field.name == "random") {
					KnownImpure("Math.random");
				} else if (resolved.owner.module == "Date" && resolved.field.name == "now") {
					KnownImpure("Date.now");
				} else {
					null;
				}
			case _:
				null;
		};
	}

	static function isReactFunction(value:ReactPlacement):Bool {
		return switch value.functionKind {
			case ClientComponent | CustomHook: true;
			case OrdinaryFunction: false;
		};
	}

	static function hookPlacementReason(value:ReactPlacement):Null<String> {
		if (value.nestedFunction) {
			return "a nested function or event-handler callback";
		}
		if (value.protectedBlock) {
			return "a try/catch block";
		}
		if (value.loop) {
			return "a loop";
		}
		if (value.conditional) {
			return "a conditional branch";
		}
		if (value.afterEarlyReturn) {
			return "code reached after a conditional early return";
		}
		return null;
	}

	static function validateHookCall(owner:ClassType, field:ClassField, value:ReactPlacement, position:Position):Void {
		final label = fieldLabel(owner, field);
		if (!isReactFunction(value)) {
			fail("NXHX-REACT-HOOK-0001",
				'Reviewed React Hook $label may only be called from a @:next.clientComponent render or an @:next.hook function. Mark a genuine custom Hook with @:next.hook; keep ordinary helpers Hook-free.',
				position);
		}
		final reason = hookPlacementReason(value);
		if (reason != null) {
			fail("NXHX-REACT-HOOK-0002",
				'Reviewed React Hook $label is called inside $reason. Call Hooks unconditionally at the top level of the Client Component or custom Hook, before any conditional early return.',
				position);
		}
	}

	static function validateReactUse(owner:ClassType, field:ClassField, value:ReactPlacement, position:Position):Void {
		final label = fieldLabel(owner, field);
		if (!isReactFunction(value)) {
			fail("NXHX-REACT-USE-0003", 'React use binding $label may only be called from a @:next.clientComponent render or an @:next.hook function.',
				position);
		}
		if (value.nestedFunction) {
			fail("NXHX-REACT-USE-0003",
				'React use binding $label cannot be called from a nested function or event-handler callback. Call it directly while the Client Component or custom Hook is rendering.',
				position);
		}
		if (value.protectedBlock) {
			fail("NXHX-REACT-USE-0003",
				'React use binding $label cannot be called inside try/catch because React uses throwing to suspend. Use an Error Boundary; conditions and loops remain valid for React use.',
				position);
		}
	}

	static function isCurrentDateConstruction(callee:TypedExpr, arguments:Array<TypedExpr>):Bool {
		if (arguments.length != 1) {
			return false;
		}
		final resolved = switch unwrapCallee(callee).expr {
			case TField(_, access): fieldAccess(access);
			case _: null;
		};
		if (resolved == null || resolved.owner.module != "js.Syntax" || resolved.field.name != "construct") {
			return false;
		}
		return switch unwrapCallee(arguments[0]).expr {
			case TTypeExpr(TClassDecl(type)): type.get().module == "Date";
			case _: false;
		};
	}

	static function failImpureCall(label:String, value:ReactPlacement, position:Position):Void {
		if (isReactFunction(value) && !value.nestedFunction) {
			fail("NXHX-REACT-PURITY-0004",
				'React render calls known non-idempotent function $label. Pass a stable value, initialize state lazily, or move the call into an event handler or Effect.',
				position);
		}
	}

	static function validateCall(call:TypedExpr, callee:TypedExpr, arguments:Array<TypedExpr>, value:ReactPlacement):Void {
		if (isCurrentDateConstruction(callee, arguments)) {
			failImpureCall("Date.now", value, call.pos);
		}
		final kind = callKind(callee);
		if (kind == null) {
			validateOrdinaryUseName(callee, value, call.pos);
			return;
		}
		switch kind {
			case ReviewedHook(owner, field):
				validateHookCall(owner, field, value, call.pos);
			case ReactUse(owner, field):
				validateReactUse(owner, field, value, call.pos);
			case KnownImpure(label):
				failImpureCall(label, value, call.pos);
		}
	}

	static function validateOrdinaryUseName(callee:TypedExpr, value:ReactPlacement, position:Position):Void {
		if (!isReactFunction(value)) {
			return;
		}
		final expression = unwrapCallee(callee);
		final resolved = switch expression.expr {
			case TField(_, access): fieldAccess(access);
			case _: null;
		};
		if (resolved == null || !~/^use(?:$|[A-Z0-9])/.match(resolved.field.name)) {
			return;
		}
		fail("NXHX-REACT-NAME-0006",
			'Ordinary function ${fieldLabel(resolved.owner, resolved.field)} uses React\'s reserved use-prefixed spelling inside a Client Component or custom Hook. Haxe does not classify it as a Hook, but official React lint must treat that emitted name as one. Rename the ordinary helper without the use prefix, or mark and structure a genuine Hook with @:next.hook.',
			position);
	}

	static function validateConstruction(type:ClassType, arguments:Array<TypedExpr>, value:ReactPlacement, position:Position):Void {
		if (type.module == "Date" && arguments.length == 0) {
			failImpureCall("Date.now", value, position);
		}
	}

	static function staticFieldTarget(expression:TypedExpr):Null<{final owner:ClassType; final field:ClassField;}> {
		final value = unwrapCallee(expression);
		return switch value.expr {
			case TField(_, access):
				final resolved = fieldAccess(access);
				switch access {
					case FStatic(_, _): resolved;
					case _: null;
				}
			case _:
				null;
		};
	}

	static function validateStaticMutation(target:TypedExpr, value:ReactPlacement, position:Position):Void {
		if (!isReactFunction(value) || value.nestedFunction) {
			return;
		}
		final resolved = staticFieldTarget(target);
		if (resolved != null) {
			fail("NXHX-REACT-PURITY-0004",
				'React render mutates non-local static field ${fieldLabel(resolved.owner, resolved.field)}. Create per-render local data, or update state from an event handler or Effect.',
				position);
		}
	}

	static function analyzeList(expressions:Array<TypedExpr>, value:ReactPlacement):ReturnFlow {
		final flows = [for (expression in expressions) analyze(expression, value)];
		return {
			mayReturn: flows.exists(flow -> flow.mayReturn),
			alwaysReturns: false
		};
	}

	static function analyzeBlock(expressions:Array<TypedExpr>, value:ReactPlacement):ReturnFlow {
		var current = value;
		var mayReturn = false;
		var alwaysReturns = false;
		for (expression in expressions) {
			if (alwaysReturns) {
				break;
			}
			final flow = analyze(expression, current);
			mayReturn = mayReturn || flow.mayReturn;
			if (flow.alwaysReturns) {
				alwaysReturns = true;
			} else if (flow.mayReturn) {
				current = withEarlyReturn(current);
			}
		}
		return {mayReturn: mayReturn, alwaysReturns: alwaysReturns};
	}

	static function analyze(expression:TypedExpr, value:ReactPlacement):ReturnFlow {
		return switch expression.expr {
			case TConst(_) | TLocal(_) | TTypeExpr(_) | TBreak | TContinue | TIdent(_):
				NO_RETURN;
			case TArray(left, right):
				analyzeList([left, right], value);
			case TBinop(op, left, right): switch op {
					case OpAssign | OpAssignOp(_): validateStaticMutation(left, value, expression.pos);
					case _:
				} final rightPlacement = switch op {
					case OpBoolAnd | OpBoolOr | OpNullCoal: withConditional(value);
					case _: value;
				}; analyzeList([left], value).mayReturn || analyze(right, rightPlacement).mayReturn ? {mayReturn: true, alwaysReturns: false} : NO_RETURN;
			case TField(target, _):
				analyze(target, value);
			case TParenthesis(inner) | TCast(inner, _) | TMeta(_, inner) | TEnumParameter(inner, _, _) | TEnumIndex(inner):
				analyze(inner, value);
			case TObjectDecl(fields):
				analyzeList([for (field in fields) field.expr], value);
			case TArrayDecl(expressions):
				analyzeList(expressions, value);
			case TCall(callee, arguments):
				validateCall(expression, callee, arguments, value);
				analyzeList([callee].concat(arguments), value);
			case TNew(type, _, arguments):
				validateConstruction(type.get(), arguments, value, expression.pos);
				analyzeList(arguments, value);
			case TUnop(op, _, inner):
				switch op {
					case OpIncrement | OpDecrement: validateStaticMutation(inner, value, expression.pos);
					case _:
				}
				analyze(inner, value);
			case TFunction(functionValue):
				analyze(functionValue.expr, withNestedFunction(value));
				NO_RETURN;
			case TVar(_, initializer):
				initializer == null ? NO_RETURN : analyze(initializer, value);
			case TBlock(expressions):
				analyzeBlock(expressions, value);
			case TFor(_, iterator, body):
				final loopPlacement = withLoop(value);
				final flow = mergeFlows([analyze(iterator, value), analyze(body, loopPlacement)]);
				{mayReturn: flow.mayReturn, alwaysReturns: false};
			case TIf(condition, positive, negative):
				final conditionFlow = analyze(condition, value);
				final branchPlacement = withConditional(value);
				final positiveFlow = analyze(positive, branchPlacement);
				final negativeFlow = negative == null ? NO_RETURN : analyze(negative, branchPlacement);
				{
					mayReturn: conditionFlow.mayReturn || positiveFlow.mayReturn || negativeFlow.mayReturn,
					alwaysReturns: conditionFlow.alwaysReturns
					|| (negative != null && positiveFlow.alwaysReturns && negativeFlow.alwaysReturns)};
			case TWhile(condition, body, _):
				final loopPlacement = withLoop(value);
				final flow = mergeFlows([analyze(condition, loopPlacement), analyze(body, loopPlacement)]);
				{mayReturn: flow.mayReturn, alwaysReturns: false};
			case TSwitch(subject, cases, fallback):
				final subjectFlow = analyze(subject, value);
				final branchPlacement = withConditional(value);
				final branchFlows = [for (caseValue in cases) analyze(caseValue.expr, branchPlacement)];
				final fallbackFlow = fallback == null ? NO_RETURN : analyze(fallback, branchPlacement);
				{
					mayReturn: subjectFlow.mayReturn || branchFlows.exists(flow -> flow.mayReturn) || fallbackFlow.mayReturn,
					alwaysReturns: subjectFlow.alwaysReturns
					|| (fallback != null
						&& branchFlows.length > 0
						&& branchFlows.foreach(flow -> flow.alwaysReturns)
						&& fallbackFlow.alwaysReturns)};
			case TTry(body, catches):
				final protectedPlacement = withProtectedBlock(value);
				final bodyFlow = analyze(body, protectedPlacement);
				final catchFlows = [for (catchValue in catches) analyze(catchValue.expr, protectedPlacement)];
				{
					mayReturn: bodyFlow.mayReturn || catchFlows.exists(flow -> flow.mayReturn),
					alwaysReturns: bodyFlow.alwaysReturns && catchFlows.foreach(flow -> flow.alwaysReturns)
				};
			case TReturn(result):
				if (result != null) {
					analyze(result, value);
				}
				{mayReturn: true, alwaysReturns: true};
			case TThrow(inner):
				analyze(inner, value);
		};
	}

	static function metadataEntries(field:ClassField, name:String):Array<MetadataEntry> {
		return field.meta.get().filter(entry -> entry.name == name);
	}

	static function validateMetadata(type:ClassType, field:ClassField, isStatic:Bool):Void {
		final hooks = metadataEntries(field, HOOK_METADATA);
		final reactUses = metadataEntries(field, REACT_USE_METADATA);
		if (hooks.length > 1 || reactUses.length > 1 || (hooks.length == 1 && reactUses.length == 1)) {
			final position = hooks.length > 1 ? hooks[1].pos : reactUses.length > 1 ? reactUses[1].pos : reactUses[0].pos;
			fail("NXHX-REACT-METADATA-0005", '${fieldLabel(type, field)} must declare at most one reviewed React call kind.', position);
		}
		final entry = hooks.length == 1 ? hooks[0] : reactUses.length == 1 ? reactUses[0] : null;
		if (entry == null) {
			return;
		}
		if (entry.params.length != 0) {
			fail("NXHX-REACT-METADATA-0005", '@${entry.name.substr(1)} on ${fieldLabel(type, field)} does not accept arguments.', entry.pos);
		}
		if (!isStatic) {
			fail("NXHX-REACT-METADATA-0005",
				'@${entry.name.substr(1)} requires a static or module-level function; ${fieldLabel(type, field)} is an instance field.', entry.pos);
		}
		switch field.type.follow() {
			case TFun(_, _):
			case _:
				fail("NXHX-REACT-METADATA-0005", '@${entry.name.substr(1)} may annotate only a function; found ${field.type.toString()}.', entry.pos);
		}
		if (hooks.length == 1 && !~/^use(?:$|[A-Z0-9])/.match(field.name)) {
			fail("NXHX-REACT-METADATA-0005",
				'Custom Hook ${fieldLabel(type, field)} must retain React\'s Haxe-visible use-prefixed naming convention as well as declaring @:next.hook.',
				entry.pos);
		}
		if (reactUses.length == 1 && field.expr() != null) {
			fail("NXHX-REACT-METADATA-0005", '@:next.reactUse is reserved for an extern binding to React use; ${fieldLabel(type, field)} has a Haxe body.',
				entry.pos);
		}
	}

	static function auditField(type:ClassType, field:ClassField, isStatic:Bool):Void {
		validateMetadata(type, field, isStatic);
		final expression = field.expr();
		if (expression == null) {
			return;
		}
		final functionKind = if (isStatic && field.name == "render" && type.meta.has(":next.clientComponent")) {
			ClientComponent;
		} else if (field.meta.has(HOOK_METADATA)) {
			CustomHook;
		} else {
			OrdinaryFunction;
		};
		final root = placement(functionKind);
		switch expression.expr {
			case TFunction(functionValue):
				analyze(functionValue.expr, root);
			case _:
				analyze(expression, root);
		}
	}

	static function auditClass(type:ClassType):Void {
		for (field in type.statics.get()) {
			auditField(type, field, true);
		}
		for (field in type.fields.get()) {
			auditField(type, field, false);
		}
		if (type.constructor != null) {
			auditField(type, type.constructor.get(), false);
		}
		if (type.init != null) {
			analyze(type.init, placement(OrdinaryFunction));
		}
	}

	static function audit(types:Array<ModuleType>):Void {
		for (type in types) {
			switch type {
				case TClassDecl(reference):
					auditClass(reference.get());
				case _:
			}
		}
	}
	#end

	/** Installs one typed React diagnostics pass for the compilation. */
	public static function install():Void {
		#if macro
		if (installed) {
			return;
		}
		installed = true;
		ReactAnalyzerFunctionMacro.install();
		Context.onAfterTyping(audit);
		#end
	}
}
