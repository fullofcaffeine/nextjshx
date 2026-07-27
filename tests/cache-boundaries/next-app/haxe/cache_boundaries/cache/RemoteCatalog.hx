package cache_boundaries.cache;

import js.lib.Promise;

/** Explicit remote capability proof; hosts still own the remote cache handler. */
@:next.cacheRemote("experimental/catalog")
class RemoteCatalog {
	@:async
	public static function label(sku:String):Promise<String> {
		return 'catalog:$sku';
	}
}
