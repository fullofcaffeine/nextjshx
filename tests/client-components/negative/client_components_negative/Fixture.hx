package client_components_negative;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
import nextjshx.adapter.AdapterPlanRegistry;
import nextjshx.app.PageLayoutMacro;
import nextjshx.client.ClientComponentMacro;

class Fixture {
	public static macro function install():Expr {
		AdapterPlanRegistry.install("tests/client-components/.tmp/rejected-plan.json", "0.0.0-development", "4.3.7",
			"1.49.0+19c9fb7197b38b5035ef286786dec71f74fabb2c", "16.2.12");
		PageLayoutMacro.install();
		ClientComponentMacro.install();
		return macro null;
	}

	public static macro function reject():Expr {
		final name = Context.definedValue("client_component_case");
		if (name == null) {
			Context.fatalError("The client_component_case define is required.", Context.currentPos());
		}
		final typeName = switch name {
			case "function-prop": "FunctionProps";
			case "class-prop": "ClassProps";
			case "unknown-prop": "UnknownProps";
			case "recursive-prop": "RecursiveProps";
			case "local-symbol-prop": "LocalSymbolProps";
			case "raw-promise-prop": "RawPromiseProps";
			case "unsupported-map-value": "UnsupportedMapValue";
			case "unsupported-set-value": "UnsupportedSetValue";
			case "unsupported-promise-result": "UnsupportedPromiseResult";
			case "unversioned-map-prop": "UnversionedMapProps";
			case "broad-array-buffer-view-prop": "BroadArrayBufferViewProps";
			case "method-flight-promise": "MethodFlightPromise";
			case "forged-server-function": "ForgedServerFunction";
			case "async-render": "AsyncRender";
			case "bad-path": "BadPath";
			case "missing-annotation-ref": "MissingAnnotationRef";
			case "raw-client-import": "RawClientPage";
			case "conditional-hook": "ConditionalHook";
			case "aliased-conditional-hook": "AliasedConditionalHook";
			case "loop-hook": "LoopHook";
			case "nested-hook": "NestedHook";
			case "event-handler-hook": "EventHandlerHook";
			case "try-hook": "TryHook";
			case "catch-hook": "CatchHook";
			case "after-return-hook": "AfterReturnHook";
			case "outside-hook": "OutsideHook";
			case "ordinary-use-name": "OrdinaryUseName";
			case "react-use-try": "ReactUseTry";
			case "react-use-outside": "ReactUseOutside";
			case "uncached-react-use": "UncachedReactUse";
			case "impure-random": "ImpureRandom";
			case "impure-date": "ImpureDate";
			case "static-mutation": "StaticMutation";
			case "callable-state": "CallableState";
			case "stored-memo-dependencies": "StoredMemoDependencies";
			case "stored-callback-dependencies": "StoredCallbackDependencies";
			case "standalone-dependencies": "StandaloneDependencies";
			case "memo-computed-dependency": "MemoComputedDependency";
			case "memo-dependency-arity": "MemoDependencyArity";
			case "named-memo-snapshot": "NamedMemoSnapshot";
			case "rest-memo-snapshot": "RestMemoSnapshot";
			case "wrong-memo-snapshot-type": "WrongMemoSnapshotType";
			case "wrong-state-replacement": "WrongStateReplacement";
			case "wrong-optimistic-action": "WrongOptimisticAction";
			case "wrong-optimistic-reducer": "WrongOptimisticReducer";
			case "unreviewed-hook-export": "UnreviewedHookExport";
			case "invalid-query-key": "InvalidQueryKey";
			case "empty-query-key": "EmptyQueryKey";
			case "dynamic-query-key": "DynamicQueryKey";
			case "wrong-query-value": "WrongQueryValue";
			case "wrong-query-updater": "WrongQueryUpdater";
			case "non-scalar-query-parser": "NonScalarQueryParser";
			case "nuqs-outside-hook": "NuqsOutsideHook";
			case "empty-string-literal-values": "EmptyStringLiteralValues";
			case "stored-string-literal-values": "StoredStringLiteralValues";
			case "open-string-literal-domain": "OpenStringLiteralDomain";
			case "mixed-string-literal-domains": "MixedStringLiteralDomains";
			case _:
				Context.fatalError('Unknown client component fixture case "$name".', Context.currentPos());
		};
		Context.getType('client_components_negative.$typeName');
		return macro null;
	}
}
#end
