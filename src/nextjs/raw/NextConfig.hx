package nextjs.raw;

/**
 * Next.js configuration accepted by the pinned public `next` entrypoint.
 *
 * The empty structural representation is intentional: NextConfig is a large,
 * plugin-extensible object whose TypeScript declaration remains the final
 * oracle. Haxe accepts a typed anonymous object without introducing Dynamic,
 * while genes-ts projects the value to Next's exact public type so unsupported
 * keys and invalid values still fail strict TypeScript validation.
 */
@:ts.type("Omit<import('next').NextConfig, 'sassOptions'> & { sassOptions?: { implementation?: string; [key: string]: unknown } }")
abstract NextConfig({}) from {} {}
