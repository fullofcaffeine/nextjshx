# How NextJsHx obtains Genes tooling

## Current decision

NextJsHx will not depend on an npm-registry release of `@genes-ts/tooling` yet.

The package source exists in the Genes repository. However, the npm registry
does not contain a public `@genes-ts/tooling` release today. NextJsHx must not
claim that users can install it by package name.

The temporary plan is to install a package archive from a GitHub release whose
immutable-release setting has been checked. That setting prevents the `.tgz`
asset from being replaced after projects start to use it. The recorded SHA-256
checksum provides a second, independent check of the downloaded bytes.

The archive is not available yet. Typed CSS Modules and other work that needs
this package remain blocked until Genes creates and reviews that archive.

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

The temporary dependency will use a remote archive URL. It will not use a
registry version such as `@genes-ts/tooling@0.1.0`.

For example, the final dependency will have this general shape:

```json
{
  "devDependencies": {
    "@genes-ts/tooling": "https://github.com/fullofcaffeine/genes-ts/releases/download/<release>/<archive>.tgz"
  }
}
```

This example contains placeholders. Do not copy it into `package.json` until
the reviewed release asset exists.

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
| GitHub release `.tgz` with immutable-release protection and an exact checksum | Planned temporary source | It gives every machine the same reviewed package bytes without an npm registry release. |
| npm registry package | Deferred | It is the preferred long-term source after the public package contract is ready. |
| Local `file:../genes/tooling` dependency | Local Genes experiments only | It depends on one developer's directory layout and cannot prove a clean consumer installation. |
| Git branch or moving tag | Not allowed | The same dependency text can produce different package bytes later. |
| Git repository subdirectory | Not used | The supported npm 10 environment cannot reliably install this package from its repository subdirectory. |
| Copied Genes tooling source inside NextJsHx | Not allowed | It creates a second implementation and prevents other Haxe projects from sharing fixes. |

## What users and agents must do

Until this document names a real archive:

1. Do not run `npm publish` for `@genes-ts/tooling`.
2. Do not add `@genes-ts/tooling@0.1.0` as a registry dependency.
3. Do not invent a GitHub archive URL.
4. Do not copy the Genes tooling implementation into this repository.
5. Keep the existing NextJsHx implementation where it still owns current
   behavior.
6. Use a local `file:` dependency only for an explicitly marked experiment.
7. Do not treat a local experiment as clean consumer or release evidence.

After the archive exists, update this document and the support matrix with its
exact identity. Then prove installation from a clean checkout before using it
in maintained examples or public setup commands.

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
