package client_components_negative;

import genes.react.Element;

using nextjs.client.ClientComponent;

class OrdinaryComponent {
	public static function render(props:{final label:String;}):Element {
		return <p>{props.label}</p>;
	}
}

class MissingAnnotationRef {
	static function main():Void {
		final Component = OrdinaryComponent.client();
		consume(Component);
	}

	static function consume<T>(value:T):Void {}
}
