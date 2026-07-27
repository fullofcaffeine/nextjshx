package nextjs.codec;

#if macro
import haxe.macro.Context;
import haxe.macro.Expr;
#else
import nextjs.raw.server.NextResponse;
import nextjs.raw.server.NextResponse.NextResponseBody;
#end

typedef DecodeIssueBody = {
	final code:String;
	final path:String;
	final message:String;
}

typedef DecodeErrorBody = {
	final ok:Bool;
	final issues:Array<DecodeIssueBody>;
}

/** Precise native Next JSON responses with compile-time JSON compatibility. */
class ResponseJson {
	public static macro function ok(body:Expr):Expr {
		Context.typeExpr(macro @:pos(body.pos) genes.ts.Json.value($body));
		return macro @:pos(body.pos) nextjs.raw.server.NextResponse.json($body);
	}

	public static macro function withStatus(body:Expr, status:Expr):Expr {
		Context.typeExpr(macro @:pos(body.pos) genes.ts.Json.value($body));
		return macro @:pos(body.pos) nextjs.raw.server.NextResponse.json($body, {status: $status});
	}

	#if !macro
	public static function invalid(issues:Array<DecodeIssue>, status:Int = 400):NextResponseBody<DecodeErrorBody> {
		if (status < 400 || status > 599) {
			throw new js.lib.Error("invalid decode response status must be between 400 and 599");
		}
		final bodyIssues:Array<DecodeIssueBody> = [];
		for (issue in issues) {
			final code:String = issue.code;
			bodyIssues.push({code: code, path: issue.path, message: issue.message});
		}
		return NextResponse.json({ok: false, issues: bodyIssues}, {status: status});
	}
	#end
}
