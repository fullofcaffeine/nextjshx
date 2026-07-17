package adapter_plan;

@:adapterPlanFixture
class PageDeclaration {
	public static function render():String {
		return "page runtime must not execute while producing the plan";
	}

	public static function revalidate():Int {
		return 60;
	}
}
