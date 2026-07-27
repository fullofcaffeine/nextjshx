package next_components;

import genes.react.Element;
import nextjs.raw.components.Form;
import nextjs.raw.components.Image;
import nextjs.raw.components.Link;
import nextjs.raw.components.Script;
import nextjs.components.NextLink;
import nextjs.navigation.CrossZone;
import nextjs.navigation.SameZone;

typedef RequiredCardProps = {
	final label:String;
}

/** One authored Next/React HXX mistake per build define. */
class NextComponentHxxNegative {
	static function Card(props:RequiredCardProps):Element {
		return <div>{props.label}</div>;
	}

	public static function main():Void {
		#if hxx_missing_link_href
		final value = <Link>Missing href</Link>;
		#elseif hxx_missing_image_alt
		final value = <Image src="/hero.png" />;
		#elseif hxx_missing_form_action
		final value = <Form><button type="submit">Missing action</button></Form>;
		#elseif hxx_wrong_script_strategy
		final value = <Script strategy="idle" />;
		#elseif hxx_missing_component_prop
		final value = <Card />;
		#elseif hxx_cross_zone_next_link
		final value = <NextLink href={CrossZone.href("/documentation")}>Wrong transition</NextLink>;
		#elseif hxx_same_zone_double_quote
		final value = SameZone.href('/unsafe"quote');
		#end
		trace(value);
	}
}
