package metadata_segment;

import metadata_segment.positive.GeneratedMetadataPage;
import metadata_segment.positive.StaticMetadataPage;

/** Keeps page href companions while publishing no application runtime. */
class NoRuntime {
	static function retain(value:String):Void {}

	static function main():Void {
		retain(StaticMetadataPage.href());
		retain(GeneratedMetadataPage.href({slug: "first"}));
	}
}
