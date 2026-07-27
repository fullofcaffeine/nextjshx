import assert from "node:assert/strict";

import { ClientConsumer } from "./.tmp/classic/route_href_fixture/ClientConsumer.js";
import { RuntimeConsumer } from "./.tmp/classic/route_href_fixture/RuntimeConsumer.js";
import { ServerConsumer } from "./.tmp/classic/route_href_fixture/ServerConsumer.js";

assert.equal(RuntimeConsumer.root(), "/");
assert.equal(RuntimeConsumer.about(), "/about");
assert.equal(RuntimeConsumer.todo("a b/c?d#e"), "/todos/a%20b%2Fc%3Fd%23e");
assert.equal(RuntimeConsumer.order(42), "/orders/42");
assert.equal(
  RuntimeConsumer.member("team a", "member/b"),
  "/teams/team%20a/members/member%2Fb",
);
assert.equal(RuntimeConsumer.docs(["a b", "c/d", "?e"]), "/docs/a%20b/c%2Fd/%3Fe");
assert.equal(RuntimeConsumer.archiveAbsent(), "/archive/");
assert.equal(RuntimeConsumer.archive(["2026", "Q 3"]), "/archive/2026/Q%203");
assert.equal(ServerConsumer.todo("shared value"), "/todos/shared%20value");
assert.equal(ClientConsumer.todo("shared value"), "/todos/shared%20value");
assert.equal(
  RuntimeConsumer.search("a b+~&=é", 7, true, "all", ["haxe next", "a+b"]),
  "/search/products?exact=true&page=7&q=a+b%2B%7E%26%3D%C3%A9&scope=all&tag=haxe+next&tag=a%2Bb",
);
assert.equal(
  RuntimeConsumer.searchWithoutOptional("haxe query"),
  "/search/all%20items?exact=false&page=1&q=haxe+query",
);
assert.equal(RuntimeConsumer.sparse(), "/about");

console.log("route-hrefs-runtime: OK: 13 path/query and shared-consumer assertions");
