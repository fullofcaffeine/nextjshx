# Generated-output ownership and preflight

NextJsHx treats every generated file as an individually proven capability. A
valid adapter plan and correct rendered bytes do not grant permission to write
an application file. The pure ownership preflight must succeed before the
transactional publisher performs any live mutation.

## Manifest v2

The machine-readable contract is
[generated-output-manifest.schema.json](../schemas/generated-output-manifest.schema.json).
The configured `.nextjshx/manifest.json` has this canonical shape:

```json
{
  "protocol": "nextjshx.generated-output",
  "version": 2,
  "generation": "64-lowercase-hex-characters",
  "nextVersion": "16.2.12",
  "genesVersion": "1.37.1+commit",
  "outputProfile": {
    "language": "typescript",
    "intent": "reviewable",
    "profileVersion": 1,
    "sourceMaps": "external",
    "sourcesContent": true,
    "declarations": "public",
    "jsxRuntime": "automatic"
  },
  "outputProfileFingerprint": "64-lowercase-hex-characters",
  "outputs": [
    {
      "path": "src/app/todos/[id]/page.tsx",
      "kind": "app-page-adapter",
      "source": "app.routes.TodoPage",
      "sha256": "64-lowercase-hex-characters"
    }
  ]
}
```

Output records are sorted bytewise by project-relative path. Paths differing
only by case are rejected for cross-filesystem safety.
`outputProfileFingerprint` is the SHA-256 of the normalized output profile.
`generation` is the SHA-256 of that profile fingerprint followed by each
sorted `path`, a NUL byte, its recorded digest, and a newline. It therefore
identifies the complete profile-and-path-to-bytes state without depending on
JSON whitespace, source names, or array input order. Unknown protocol versions,
unknown keys, duplicates, non-canonical ordering, mismatched profile
fingerprints, and inconsistent generation digests fail closed.

Manifest v1 remains readable for the bounded config-v1 migration window. It is
validated with its original digest algorithm and normalized in memory to the
legacy TypeScript/reviewable profile. Reading never rewrites it; the next
ordinary successful publication records manifest v2 transactionally.

A missing manifest means NextJsHx owns no live output. A malformed manifest is
preserved for inspection and is never treated like a missing manifest.

## Pure preflight

Preflight receives the canonical project root, configured manifest path,
explicit project-relative output-root allowlist, an optional exact-file
allowlist, exact Next and Genes versions, the effective output profile, and the
complete intended adapter bytes. It only reads filesystem metadata and
content. It does not create directories, write adapters, remove stale files,
or replace the manifest.

Before returning a plan, it:

1. canonicalizes the real project root, every allowlisted output root, and
   every non-redundant exact output file;
2. rejects absolute, traversal, platform-specific, non-normalized, duplicate,
   reserved, and non-TypeScript targets;
3. rejects symbolic-link targets or path components and output-root escapes;
4. parses the previous manifest with exact version semantics;
5. verifies that every previously owned regular file exists and still matches
   its recorded SHA-256;
6. rejects every existing intended target absent from that verified manifest;
7. hashes the complete intended bytes and creates the next canonical manifest;
8. classifies each path as `create`, `update`, `unchanged`, or `remove`.

Every check completes before publication receives authority to change one
byte. The next transactional layer must re-use this result immediately and
still journal and recheck state around publication; preflight does not claim to
eliminate filesystem races by itself.

The implemented formatter, staging, atomic write, journal, rollback, lock, and
crash-recovery contract is documented in
[generated-output publication and recovery](generated-output-publication.md).

## Paths NextJsHx never owns implicitly

Reserved targets include `.nextjshx/**`, `.next/**`, `.git/**`,
`node_modules/**`, `public/**`, package and workspace manifests, lockfiles,
`next-env.d.ts`, `next.config.*`, `tsconfig*.json`, environment files, and
deployment configuration. Generated ownership is limited to `.ts` and `.tsx`
files under explicit output roots or an explicitly reviewed exact-file entry.
The current exact-file use is Next's `proxy.ts` convention: `proxy.ts` beside
`app/`, or `src/proxy.ts` beside `src/app/`. This does not authorize sibling
files in the package root or `src/`, and an exact file already covered by a
broad root is rejected as redundant. Genes output is not owned merely because
a NextJsHx command orchestrated its build.

An existing native target is rejected even when its bytes happen to equal the
planned adapter. Its diagnostic identifies the target and claiming Haxe source,
then offers only explicit choices: move or rename the Haxe route, keep the
native route, adopt ownership through a reviewed workflow, or remove one
source. Default exports and route modules are never merged automatically.

A missing or hand-modified owned output also blocks ordinary generation. The
diagnostic includes the expected and current digest when bytes exist. Repair,
adopt, release, cleanup, journaling, and atomic publication remain explicit
operations; there is no force path that bypasses containment or symlink checks.
The implemented `clean` command submits an empty intended tree to the ordinary
transactional publisher, so all records are verified before any deletion and
native siblings remain untouched.

The explicit `adopt`, `release`, and `repair` commands use the same lock,
journal, validation, rollback, and recovery machinery. Their journal entries
keep ownership digests (manifest claims) separate from live-file digests
(rollback and publication bytes). That permits metadata-only adoption and
release without rewriting the file, and lets repair restore locally modified
bytes on validation failure. Every non-target path must retain the same source,
kind, digest, and verified live bytes. Repair cannot change source identity or
adapter kind; use release followed by adopt for that reviewed migration.

Focused evidence is available through:

```sh
npm run test:ownership-preflight
npm run test:proxy
```
