import type { NextRequest } from "next/server";

// Negative control: NextRequest inherits the DOM `json(): Promise<any>` result,
// so strict TypeScript currently accepts this unchecked string claim.
export async function uncheckedJson(request: NextRequest): Promise<string> {
  return request.json();
}
