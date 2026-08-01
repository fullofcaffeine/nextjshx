package special_files.positive;

import genes.react.Element;
import js.lib.Promise;
import nextjs.app.DefaultProps;

typedef DefaultParams = {
	final id:String;
}

@:next.default("proof/[id]/@sidebar")
function render(props:DefaultProps<DefaultParams>):Promise<Element> {
	return props.params.then(params -> <aside id="haxe-default-parameterized">Fallback for {params.id}</aside>);
}
