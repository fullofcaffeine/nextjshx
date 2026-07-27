import {NextResponse} from "next/server"
import {Register} from "../genes/Register"

export class RequestProxy {
	static proxy(request: Omit<import('next/server').NextRequest, 'json'> & { json(): Promise<unknown> }): Omit<import('next/server').NextResponse<unknown>, 'json'> & { json(): Promise<unknown> } {
		const response: Omit<import('next/server').NextResponse<unknown>, 'json'> & { json(): Promise<unknown> } = NextResponse.next();
		response.headers.set("x-nextjshx-proxy", request.nextUrl.pathname);
		return response;
	}
	static get __name__(): string {
		return "request_proxy_fixture.RequestProxy"
	}
	get __class__(): Function {
		return RequestProxy
	}
}
Register.setHxClass("request_proxy_fixture.RequestProxy", RequestProxy);
