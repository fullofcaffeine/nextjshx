import type { Route } from "next";

export const rootRoute: Route<"/"> = "/";
export const aboutRoute: Route<"/about"> = "/about";
export const archiveAbsentRoute: Route<"/archive/"> = "/archive/";
export const archivePresentRoute: Route<"/archive/nextjshx-probe/tail"> =
  "/archive/nextjshx-probe/tail";
export const catalogRoute: Route<"/catalog/nextjshx-probe"> =
  "/catalog/nextjshx-probe";
export const docsRoute: Route<"/docs/nextjshx-probe/tail"> =
  "/docs/nextjshx-probe/tail";
export const orderRoute: Route<"/orders/nextjshx-probe"> =
  "/orders/nextjshx-probe";
export const memberRoute: Route<
  "/teams/nextjshx-probe/members/nextjshx-probe"
> = "/teams/nextjshx-probe/members/nextjshx-probe";
export const todoRoute: Route<"/todos/nextjshx-probe"> =
  "/todos/nextjshx-probe";
export const todoQueryRoute: Route<"/todos/nextjshx-probe?page=2&tag=haxe"> =
  "/todos/nextjshx-probe?page=2&tag=haxe";
