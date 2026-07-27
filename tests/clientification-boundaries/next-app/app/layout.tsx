import type { ReactNode } from "react";

export default function RootLayout(props: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  );
}
