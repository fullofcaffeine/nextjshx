# Semantic codec evidence

This fixture proves the `nextjs.codec.*` boundary in both genes-ts output
profiles. The TypeScript lane compiles with strict library checking; the
classic lane runs on Node's native Fetch, `FormData`, and `URLSearchParams`
implementations.

Positive evidence decodes an exact JSON object, form fields, scalar and
repeated query values, and locally typed `NextResponse` JSON. Runtime negative
controls cover invalid JSON syntax, wrong and missing field types, extra fields,
an unparseable form request, duplicate form scalars, extra query fields, and
integer overflow. The signed 32-bit endpoints are positive controls.
Compile-fail controls show that an untrusted `Unknown` cannot masquerade as a
domain string and that a function cannot be sent through the checked JSON
response helper.
