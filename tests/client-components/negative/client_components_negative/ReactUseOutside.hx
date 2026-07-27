package client_components_negative;

import client_components_negative.HookBindings.NegativeCachedResource;
import nextjs.client.React;

class ReactUseOutside {
	public static function read():String {
		return React.use(NegativeCachedResource.label());
	}
}
