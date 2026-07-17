package adapter_plan;

@:adapterPlanFixture
class ClientDeclaration {
	public static function render():String {
		return "client runtime must not execute while producing the plan";
	}
}
