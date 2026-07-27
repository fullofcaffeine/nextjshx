package nextjs.content;

/** Root-relative image with required accessible alternative text. */
typedef MediaBlock = {
	final src:SafeMediaPath;
	final alt:String;
	final caption:Null<String>;
	final width:Int;
	final height:Int;
}
