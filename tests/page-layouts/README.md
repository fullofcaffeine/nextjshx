# Page/layout declaration fixture

This focused no-output fixture validates the Haxe-owned page and layout
declaration boundary before any App Router file is published.

The positive set covers a root page, dynamic page, root layout, and nested
dynamic layout with synchronous and Promise element returns. The inert main
also calls the page macros' injected static and dynamic `href()` companions.
The TypeScript lane inspects their exact `Route<Pattern>` projections, proves
the inline calls do not import a server page implementation, and runs strict
TypeScript with `skipLibCheck: false`.
The reviewed plan snapshot retains exact declaration ranges, source fields,
implementation imports, targets, and Next route-literal signatures while
proving no business logic or application JavaScript enters the adapter plan.

Eight isolated negative controls lock missing render, structural props
lookalikes, an unvalidated query type, wrong dynamic params, an incompatible
render result, mutation of Next-owned search input, and a named export that is
reviewed but not yet safely published. Each must produce one exact
source-positioned diagnostic and no partial plan.

Run it with:

```sh
npm run test:page-layouts
```
