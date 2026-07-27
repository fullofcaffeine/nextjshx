import {
  NextResponse,
  URLPattern,
  type NextProxy,
  type NextRequest,
} from "next/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

type SafeNextRequest = Omit<NextRequest, "json"> & {
  json(): Promise<unknown>;
};

revalidatePath("/todos", "segment");
revalidateTag("todos");
unstable_cache((value: string) => value);
NextResponse.redirect("/todos", "temporary");
new URLPattern().test(42);
NextResponse.next({ request: { headers: "authorization: unsafe" } });

export const invalidProxy: NextProxy = () => 42;

export async function uncheckedJson(request: SafeNextRequest): Promise<string> {
  return request.json();
}
