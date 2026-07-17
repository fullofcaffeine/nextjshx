# Adapter-plan contract fixture

This fixture exercises the schema-v1 adapter plan before rendering or live
App Router publication exists. It uses real Haxe class, field, and metadata
positions, but `--no-output` prevents application JavaScript from being
generated or executed.

The focused runner compiles the same two declarations in forward and reverse
registration order and requires byte-identical, schema-valid JSON matching the
reviewed snapshot. Its negative build requests one target twice; the exact
source-positioned diagnostic must leave pre-existing plan bytes unchanged.

```sh
npm run test:adapter-plan
```
