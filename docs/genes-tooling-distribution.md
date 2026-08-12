# How NextJsHx obtains Genes tooling

## Current decision

NextJsHx will not depend on an npm-registry release of `@genes-ts/tooling` yet.

The package source exists in the Genes repository. The npm registry does not
contain a public `@genes-ts/tooling` release. NextJsHx installs the package from
an exact GitHub Release archive instead.

The current setup installs a package archive from a GitHub release whose
immutable-release setting has been checked. That setting prevents the `.tgz`
asset from being replaced after projects start to use it. The recorded SHA-256
checksum provides a second, independent check of the downloaded bytes.

The reviewed archive is now available:

- package: `@genes-ts/tooling` version `0.2.0`;
- Genes source commit: `603ed8349775f86438a8b5be99cafa1a36544644`;
- release: [`tooling-v0.2.0`](https://github.com/fullofcaffeine/genes-ts/releases/tag/tooling-v0.2.0);
- archive: [`genes-ts-tooling-0.2.0.tgz`](https://github.com/fullofcaffeine/genes-ts/releases/download/tooling-v0.2.0/genes-ts-tooling-0.2.0.tgz);
- SHA-256: `7ac3754cedc24f4aaf75d30e29fc9972f593c998af2a3e0fda8dd2c234eb76e6`;
- npm integrity: `sha512-A5fg4R6xoU/G8Z44vVO6yLzAXPYwKz+GjVnTpRCLQHqbkPuh5A+N0OSuK+iNm0o3dPBfxyMbntgh+ku4KOWQOQ==`.

GitHub marks this release as immutable. This means that GitHub does not permit
changes to the release or its files. The lockfile also checks the archive bytes
during each clean npm install.

## Why we are delaying the npm release

The Genes tooling package is a reusable part of the compiler toolchain. It is
not specific to Next.js. NextJsHx, WordPressHx, and other Haxe-to-JavaScript or
Haxe-to-TypeScript projects can use it.

Publishing it to the npm registry makes a lasting public promise. A published
package name and version cannot later point to different bytes. We want to
prove the first real framework integration before making that promise.

A GitHub archive gives us the same package contents for early integration. It
also lets npm install the package into `node_modules`. The archive delays the
registry release, but it does not permit weaker review or mutable package
bytes.

## What npm means here

`npm` and the npm registry are different things:

- `npm` is the command that installs packages.
- The npm registry is one server from which `npm` can download packages.
- `npm` can also install a local folder, a local archive, a remote archive, or
  a Git repository.

The dependency uses a remote archive URL. It does not use a
registry version such as `@genes-ts/tooling@0.2.0`.

The dependency has this exact form:

```json
{
  "devDependencies": {
    "@genes-ts/tooling": "https://github.com/fullofcaffeine/genes-ts/releases/download/tooling-v0.2.0/genes-ts-tooling-0.2.0.tgz"
  }
}
```

Do not replace this URL with a branch, a moving tag, or a registry version.

## Required record for the archive

Before NextJsHx can depend on the archive, its change must record:

- the exact Genes source commit;
- the exact GitHub release URL;
- the archive SHA-256 checksum;
- the package name and version inside the archive;
- the npm integrity value recorded in the lockfile;
- the Node and npm versions used to install it;
- the tests that prove a clean installation and real Next.js use.

The dependency must use an exact URL. It must not use a branch, a moving tag,
or a URL whose bytes can change.

## Sources that are and are not allowed

| Package source | Current use | Reason |
| --- | --- | --- |
| GitHub release `.tgz` with immutable-release protection and an exact checksum | Current source | It gives every machine the same reviewed package bytes without an npm registry release. |
| npm registry package | Deferred | It can become the long-term source after the public package contract is ready. |
| Local `file:../genes/tooling` dependency | Local Genes experiments only | It depends on one developer's directory layout and cannot prove a clean consumer installation. |
| Git branch or moving tag | Not allowed | The same dependency text can produce different package bytes later. |
| Git repository subdirectory | Not used | The supported npm 10 environment cannot reliably install this package from its repository subdirectory. |
| Copied Genes tooling source inside NextJsHx | Not allowed | It creates a second implementation and prevents other Haxe projects from sharing fixes. |

## What users and agents must do

1. Do not run `npm publish` for `@genes-ts/tooling`.
2. Do not add `@genes-ts/tooling@0.2.0` as a registry dependency.
3. Do not change the exact archive URL without a reviewed release update.
4. Do not copy the Genes tooling implementation into this repository.
5. Keep NextJsHx-specific behavior in NextJsHx.
6. Use a local `file:` dependency only for an explicitly marked experiment.
7. Do not treat a local experiment as clean consumer evidence.

`support_matrix.json` is the source of truth for this package identity. The
support-matrix check compares that record with `package.json` and the lockfile.

## Later npm release

The GitHub archive is a temporary delivery method. It does not replace the
long-term npm package.

An npm registry release becomes appropriate after the package has:

- a stable public entry point;
- clear user documentation;
- clean package-content checks;
- at least one proven framework consumer;
- an independent release review;
- a safe first-publication process.

Moving from the archive to npm must not change the package behavior. The
registry package must contain the same reviewed public files and pass the same
consumer tests.

For npm's supported package sources, see the official
[npm install documentation](https://docs.npmjs.com/cli/install/).
