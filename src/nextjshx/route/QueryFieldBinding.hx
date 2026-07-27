package nextjshx.route;

#if macro
import haxe.macro.Type;

/** Cardinality carried by one closed query-schema field. */
enum QueryFieldCardinality {
	Required;
	Optional;
	Repeated;
}

/** Reviewed scalar conversion applied before native URLSearchParams encoding. */
enum QueryValueEncoding {
	Text;
	Int32;
	Boolean;
	Custom(codecType:String);
}

/** One validated source field and its canonical wire representation. */
@:structInit
class QueryFieldBinding {
	public final fieldName:String;
	public final queryName:String;
	public final cardinality:QueryFieldCardinality;
	public final encoding:QueryValueEncoding;
	public final position:haxe.macro.Expr.Position;

	public function new(fieldName:String, queryName:String, cardinality:QueryFieldCardinality, encoding:QueryValueEncoding, position:haxe.macro.Expr.Position) {
		this.fieldName = fieldName;
		this.queryName = queryName;
		this.cardinality = cardinality;
		this.encoding = encoding;
		this.position = position;
	}
}

/** The exact query type and canonical bindings accepted by a route companion. */
@:structInit
class QuerySchemaValidation {
	public final queryType:Type;
	public final bindings:Array<QueryFieldBinding>;

	public function new(queryType:Type, bindings:Array<QueryFieldBinding>) {
		this.queryType = queryType;
		this.bindings = bindings;
	}
}
#end
