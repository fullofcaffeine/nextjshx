package nextjshx.adapter;

/** Exact toolchain identities attached to a generated adapter plan. */
@:structInit
class AdapterToolchain {
	public final nextjshx:String;
	public final haxe:String;
	public final genesTs:String;
	public final next:String;

	public function new(nextjshx:String, haxe:String, genesTs:String, next:String) {
		this.nextjshx = nextjshx;
		this.haxe = haxe;
		this.genesTs = genesTs;
		this.next = next;
	}
}
