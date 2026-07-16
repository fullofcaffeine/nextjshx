import app.HelloView;

class FixtureMain {
	public static function main():Void {
		// The hand-written TypeScript adapter is invisible to Haxe DCE. This
		// temporary F05 reachability root is intentionally removed by later
		// adapter-plan/DCE work.
		HelloView.render();
	}
}
