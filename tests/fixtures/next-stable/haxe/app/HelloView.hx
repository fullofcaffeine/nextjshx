package app;

import genes.react.Element;

/**
 * Provides the Haxe-owned component imported by an authored TypeScript module.
 *
 * Why: Haxe DCE cannot see the import in `app/page.tsx`. Without an explicit
 * external-entry policy, the component can disappear even though the final
 * TypeScript graph uses it.
 *
 * What: `@:keep` retains this narrow application-local entry point. Published
 * libraries should use genes-ts's opt-in reusable-library profile instead.
 *
 * How: the build includes the owning package so Haxe types this module; the
 * standard metadata then roots the class before genes-ts emits split modules.
 * The TypeScript adapter can import it without a fake Haxe call.
 */
@:keep
class HelloView {
	public static function render():Element {
		return <main id={"nextjshx-fixture"}>
      <h1>Haxe → genes-ts → Next.js</h1>
      <p>This production-rendered element originated in typed Haxe.</p>
    </main>;
	}
}
