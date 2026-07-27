# Maintained example guidance

Examples are executable product documentation. A newcomer who knows Haxe or
Next.js should be able to understand the application without first learning
NextJsHx internals.

- Prefer module-level functions and values for module-scoped behavior. Do not
  introduce a class merely to hold static fields. Retain a class only when
  construction, runtime identity, inheritance, an interface, class metadata,
  or an exact framework/compiler export contract requires it; explain that
  reason beside any retained all-static class.
- Prefer typed `map`, `filter`, `find`, `findIndex`, `some`, `every`,
  `flatMap`, `reduce`, `reduceRight`, `at`, and similar collection operations
  only when they keep both Haxe source and generated genes output recognizable
  to JavaScript/TypeScript developers. Inspect the generated module: a retained
  Lambda support module is not an improvement over a clear loop merely because
  the Haxe call says `find`. Prefer functional pipelines when their
  transformations and accumulator type stay clear. Keep loops for genuinely
  stateful, indexed, multi-accumulator, allocation-sensitive, or
  control-flow-heavy work; do not force fluent chains merely for style.
  hxnodejs is for Node.js APIs, not language-level Array ergonomics. A faithful
  JS-native Array surface and semantics-preserving portable lowering are
  distinct generic genes concerns; do not invent either one locally in an
  example.
- Document every nontrivial module/class and complex function in friendly
  why/what/how terms. Explain the application or compiler contract it owns, the
  important data/control flow, and the ordinary native artifact or runtime
  behavior it produces. Do not merely restate the name or syntax.
- Explain the first use of each NextJsHx annotation, macro, boundary reference,
  generated companion, or semantic facade. State both what it guarantees and
  what remains the responsibility of Next.js, React, or application code.
- Keep the Haxe source representative of the recommended product API. Compiler
  plans, adapter identities, and other temporary setup machinery must be
  clearly labeled as tooling scaffolding rather than copied as application
  architecture.
- Show an equally idiomatic vanilla Next.js/TypeScript version of the same
  behavior in learner documentation. Use direct TSX, module functions,
  canonical imports, ordinary CSS/package workflows, and safe validation. Name
  exactly what Haxe checks earlier or expresses once; never weaken the native
  comparison to manufacture an advantage.
- Preserve generated-output ownership. Teach readers to edit Haxe or
  native-owned source and use inspection commands instead of patching
  manifest-owned adapters or `src-gen`.

Before finishing an example change, run its documented typecheck/build/smoke
commands and verify that its README, comments, and generated output still agree.
