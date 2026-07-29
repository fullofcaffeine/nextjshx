package nextjshx.boundary;

#if macro
import genes.react.flight.v19.FlightExtensionDecision;
import genes.react.flight.v19.FlightValidationKind;
import genes.react.flight.v19.FlightValueValidation.validateFlightValue;
import haxe.macro.Context;
import haxe.macro.Expr.Position;
import haxe.macro.Type;

using haxe.macro.TypeTools;

/**
 * Adds only NextJsHx provenance-bearing capabilities to Genes' React Flight
 * value algebra.
 *
 * Genes owns reusable React 19 values and recursive validation. This policy
 * remains local because module-stable Flight Promises, generated Server
 * Functions, cached resources, and the raw Next ReactNode view depend on
 * NextJsHx graph and construction proofs.
 */
private function nextFlightPolicy(type:Type, path:String):FlightExtensionDecision {
	return switch type {
		case TAbstract(reference, parameters):
			final definition = reference.get();
			if (definition.module == "nextjs.client.flight.v19.FlightPromise"
				&& definition.name == "FlightPromise"
				&& parameters.length == 1) {
				Recurse([
					{
						type: parameters[0],
						path: path + ".resolved",
						position: null
					}
				]);
			} else if (definition.module == "nextjs.client.flight.v19.FlightServerFunction"
				&& definition.name == "FlightServerFunction"
				&& parameters.length == 1) {
				Accept;
			} else if (definition.module == "nextjs.raw.react.ReactNode" && definition.name == "ReactNode" && parameters.length == 0) {
				Accept;
			} else {
				Unhandled;
			}
		case TInst(reference, parameters):
			final definition = reference.get();
			if (definition.module == "nextjs.client.CachedPromise" && definition.name == "CachedPromise" && parameters.length == 1) {
				Recurse([
					{
						type: parameters[0],
						path: path + ".resolved",
						position: null
					}
				]);
			} else {
				Unhandled;
			}
		case _:
			Unhandled;
	};
}

/**
 * Validates one Next Server-to-Client value and preserves the existing
 * NextJsHx diagnostic contract.
 *
 * Reusable React rules come from Genes. This adapter supplies only
 * Next-specific capability provenance, maps the structured issue to
 * `NXHX-SERIALIZABLE-PROP-0001`, and uses the deepest source position Genes
 * found while walking a closed record.
 */
function validate(type:Type, root:String, position:Position):Void {
	final validationIssue = validateFlightValue(type, root, nextFlightPolicy, position);
	if (validationIssue == null) {
		return;
	}
	final reason = switch validationIssue.kind {
		case UnresolvedType:
			"the type is not concrete at the boundary.";
		case RecursiveValue:
			"recursive or cyclic value graphs are rejected conservatively.";
		case BroadExternalValue:
			"broad external-boundary values must be decoded before crossing into a Client Component.";
		case UnsupportedAbstract:
			"only abstracts whose runtime representation is a string, number, or boolean are allowed.";
		case RawPromise:
			"an ordinary Promise does not prove server ownership or stable React identity; use FlightPromise from a reviewed server-owned provider.";
		case RawSymbol:
			"a raw symbol does not prove global-registry provenance; create FlightGlobalSymbol with FlightGlobalSymbol.forKey(...).";
		case UnsupportedClass:
			"class instances and runtime containers do not have a stable plain-value encoding.";
		case OrdinaryFunction:
			"ordinary functions cannot cross the Server-to-Client boundary; use a generated Server Function ref when that feature is intended.";
		case RuntimeEnum:
			"runtime Haxe enum instances are not treated as plain records; use a string or number enum abstract.";
		case DynamicValue:
			"a broad dynamic value must be decoded into a closed model first.";
		case HostRejected:
			validationIssue.reason;
	};
	final issuePosition = validationIssue.position == null ? position : validationIssue.position;
	Context.fatalError('[NXHX-SERIALIZABLE-PROP-0001] ${validationIssue.path} is not a supported React boundary value: $reason Found ${validationIssue.type.toString()}. Use primitives, arrays, plain immutable records, ReactNode composition, or an exact nextjs.client.flight.v19 capability.',
		issuePosition);
}
#end
