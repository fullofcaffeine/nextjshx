# Portable content-block evidence

This fixture sends JSON-shaped remote content through `genes.ts.Unknown`,
decodes it immediately into `nextjs.content.ContentBlock`, and renders every
closed variant as semantic React markup.

The positive document exercises headings, prose, callouts, quotes, display-only
code, data series, root-relative media, and metrics. Negative controls reject
an MDX/JSX block kind, a wrong field type, an unexpected executable field, a
remote media URL, an encoded traversal path, a malformed data point, and an
unsupported callout tone.

The code example deliberately contains a `<script>` string. React renders it as
escaped text; the content layer never evaluates it.

An incomplete renderer is a compile-time negative control: omitting `Metric`
produces Haxe's exact `Unmatched patterns: Metric` diagnostic.
