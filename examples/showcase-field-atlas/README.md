# Field Atlas

Field Atlas is the end-to-end MDX and portable-content showcase:

- Haxe owns the App Router layout, home page, portable briefing page, and
  interactive Recharts component.
- Trusted local MDX remains native `.mdx` source compiled by `@next/mdx`.
- `@:next.mdxComponents` publishes the required manifest-owned root registry.
- The registry preserves the exact Haxe component map through a zero-wrapper
  `typeof` alias.
- GFM, heading slugs, and syntax highlighting run as normal Next MDX plugins.
- A separate JSON briefing decodes into the closed portable content algebra;
  it cannot import or execute JSX.
- Shared shadcn components provide the Button, Badge, and Card primitives.

Run `npm run build --workspace @nextjshx/showcase-field-atlas` for the strict
production path. The repository showcase lane additionally checks deterministic
generation, native MDX output, hydrated chart behavior, portable-content HTML,
mobile layout, console errors, and ownership cleanup.
