import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../public/styles.css";

export const metadata: Metadata = {
  title: "Patchbay 06 — A mixed NextJsHx adoption lab",
  description:
    "A native Next.js application adopting typed Haxe one boundary at a time.",
};

export default function RootLayout(props: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
