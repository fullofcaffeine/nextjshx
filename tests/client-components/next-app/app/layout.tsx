import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23102a2e'/%3E%3Cpath d='M14 37c8-12 14 12 22 0s12 2 14 5' fill='none' stroke='%238bd8cf' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E"
        />
      </head>
      <body
        style={{
          margin: 0,
          background: "#e8f0ef",
          color: "#102a2e",
          fontFamily: "Avenir Next, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
