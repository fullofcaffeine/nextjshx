package client_components_negative;

import genes.react.Element;
import nextjs.raw.react.ReactNode;

using nextjs.client.ClientComponent;

private typedef ClientRefProps = {
	final label:String;
	final count:Int;
	final children:ReactNode;
}

@:next.clientComponent
private class ClientRefTarget {
	public static function render(props:ClientRefProps):Element {
		return <p>{props.label}{props.count}{props.children}</p>;
	}
}

class ClientRefWrongProp {
	static function main():Void {
		final Target = ClientRefTarget.client();
		final invalid = <Target label="Typed boundary" count="two"><span>Child</span></Target>;
		consume(invalid);
	}

	static function consume<T>(value:T):Void {}
}
