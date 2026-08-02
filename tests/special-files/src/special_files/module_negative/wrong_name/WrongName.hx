package special_files.module_negative.wrong_name;

import genes.react.Element;

@:next.loading("negative/module-wrong-name")
function fallback():Element {
	return <p>invalid</p>;
}
