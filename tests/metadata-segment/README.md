# Metadata, static params, and segment config fixture

This focused fixture proves that page/layout metadata and static params retain
their semantic Haxe types, while `SegmentConfig.create({...})` is validated and
erased before genes-ts output. Its adapter-plan snapshot contains only closed
named exports and tagged literals; the renderer then produces ordinary Next
TypeScript and strict TypeScript checks the complete delegation boundary.

Fourteen isolated failures also prove that metadata types cannot be replaced by
structural lookalikes, static params must match the route, config stays literal
and version-stable, and foreign qualified names cannot masquerade as the erased
semantic marker.

Run it with:

```sh
npm run test:metadata-segment
```
