package compiler_gaps;

/**
 * Reduces default-export selection to a top-level Haxe module function.
 *
 * `@:expose` proves the supported named root export. The second metadata is an
 * inert research marker: G03 decides whether a generic default-export feature
 * is justified or whether consumers should keep using explicit adapters.
 */
@:expose
@:genes.defaultExport
function exportedLabel():String {
	return "exported-label";
}
