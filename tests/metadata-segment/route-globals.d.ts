import type { ReactNode } from "react";

interface MetadataSegmentParamMap {
  "/proof/static-metadata": Record<never, never>;
  "/proof/products/[slug]": { slug: string };
  "/proof/catalog/[category]": { category: string };
}

declare global {
  interface PageProps<Route extends keyof MetadataSegmentParamMap> {
    params: Promise<MetadataSegmentParamMap[Route]>;
    searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
  }

  type LayoutProps<Route extends keyof MetadataSegmentParamMap> = {
    params: Promise<MetadataSegmentParamMap[Route]>;
    children: ReactNode;
  };
}

export {};
