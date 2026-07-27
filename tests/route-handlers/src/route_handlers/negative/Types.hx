package route_handlers.negative;

import js.lib.Promise;

typedef CorrectParams = {
	final id:String;
}

typedef WrongParams = {
	final slug:String;
}

typedef StructuralContext = {
	final params:Promise<CorrectParams>;
}
