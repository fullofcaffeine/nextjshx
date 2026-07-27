# Server Function fixture

This fixture proves that Haxe-owned `@:next.serverFunctions` declarations become
native, directive-first Next.js action modules and are consumed through
`ServerFunction.ref` without importing the raw server implementation into the
client graph.

The sensitive fixture action runs through `GuardedAction`: closed form decode,
request-local identity, authenticated workspace resolution, exact save policy,
an operation-scoped witness, a server-only mutation service, and an explicit
domain-to-public projection. A classic JavaScript probe asserts exact call
order, short-circuiting, missing/denied normalization, stale-object denial,
mutation-error propagation, and secret-free projection.

The production browser lane submits real `FormData`, then tampers with the
workspace identifier, replays a stale version, submits malformed input, removes
the session after the UI has rendered, and exceeds a configured 2 KB native
Next body limit. Only the valid authorized request mutates the HTTP-only cookie;
the domain audit secret never reaches the action response.

Thirteen exact negative controls reject synchronous exports, broad result types,
unsafe class arguments, optional arguments, invalid paths, unmarked public
fields, invalid refs, a Client Component's raw action import, private witness
construction, a broad or wrong-operation witness, an omitted authorizer, and
witness serialization before a rejected adapter plan can be published.

Run from the repository root:

```bash
npm run test:server-functions
```
