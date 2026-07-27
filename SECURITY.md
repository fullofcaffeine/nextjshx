# Security policy

NextJsHx processes source code, TypeScript declarations, route and filesystem
metadata, generated paths, package configuration, environment boundaries, and
tool output. Please report behavior that could cross one of those trust
boundaries privately.

## Reporting a vulnerability

Use GitHub's
[private vulnerability reporting form](https://github.com/fullofcaffeine/nextjshx/security/advisories/new)
as the preferred channel. If that form is unavailable, email
[boss@fullofcaffeine.com](mailto:boss@fullofcaffeine.com) with the subject
`[NextJsHx security]`.

Do not open a public issue, pull request, discussion, or Beads issue containing
vulnerability details. Do not attach live credentials, private source,
personal data, destructive payloads, or secrets from another system. Send only
the minimum sanitized material needed to establish a protected follow-up
channel.

## Current support status

There is no published or supported release. Security fixes target the active
development branch on a best-effort basis until a release policy says
otherwise.

## Relevant security scope

Examples include:

- generated-code, directive, export, or module-specifier injection;
- path traversal, symlink escape, unsafe overwrite, or deletion outside
  manifest-owned generated files;
- server-only values, environment data, or implementation modules entering a
  client bundle;
- malformed declaration, config, manifest, route, request, form, or JSON input
  escaping its typed boundary;
- shell, argument, package-manager, watcher, or build-tool invocation
  injection;
- dependency, CI action, vendoring, package, checksum, or release provenance
  compromise; and
- secret exposure through Git history, generated output, logs, or Beads/Dolt
  issue history.

Ordinary unsupported features, performance questions, documentation errors,
and non-security type or code-generation bugs belong in the normal workflow
once they can be discussed without exposing a vulnerability. When uncertain,
report privately first.

## Repository safeguards

Tracked hooks scan staged content, full reachable Git history, and decoded
Beads records. CI installs a checksum-pinned Gitleaks binary, pins external
Actions to full commit SHAs, verifies exact Haxe formatting, and audits locked
npm dependencies.

Before changing repository visibility or publishing a reachable ref, run:

```sh
npm run public:preflight
```

Publish Beads data only with `npm run beads:push`. Repository-host settings such
as private vulnerability reporting, secret scanning, push protection,
Dependabot security updates, and branch protection must be enabled and verified
separately from repository files.
