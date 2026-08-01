package special_files.positive;

import genes.react.Element;
import js.lib.Promise;

@:next.loading("proof/loading")
function render():Promise<Element> {
	return Promise.resolve(<p id={"haxe-loading"}>LOADING-BUSINESS</p>);
}
