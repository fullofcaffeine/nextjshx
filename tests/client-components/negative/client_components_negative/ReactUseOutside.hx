package client_components_negative;

import client_components_negative.HookBindings.NegativeCachedResource;
import nextjs.client.React.use;

class ReactUseOutside {
	public static function read():String {
		return use(NegativeCachedResource.label());
	}
}
