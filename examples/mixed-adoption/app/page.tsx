import Link from "next/link";

import { Badge } from "@nextjshx/showcase-ui/badge";

import { NativeBridgeDeck } from "./native-bridge-deck";

export default function NativeHomePage() {
  return (
    <main>
      <header className="masthead">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark">P/06</span>
          <span>Patchbay</span>
        </Link>
        <nav aria-label="Primary navigation">
          <a href="#bridge">Live bridge</a>
          <Link href="/haxe-lab">Haxe-owned route</Link>
        </nav>
        <span className="masthead-status">
          <i />
          mixed graph online
        </span>
      </header>

      <section className="native-hero">
        <div className="hero-index">01 — NATIVE ENTRY</div>
        <div className="hero-copy">
          <Badge variant="outline" className="language-badge">
            Existing Next.js / TypeScript route
          </Badge>
          <h1>
            Keep the app.
            <br />
            <em>Change the leverage.</em>
          </h1>
          <p>
            Patchbay 06 starts as ordinary App Router source. Typed Haxe enters
            through explicit seams—without turning TypeScript into generated
            glue or surrendering Next.js ownership.
          </p>
        </div>
        <aside className="hero-ledger" aria-label="Adoption ledger">
          <span>source owner</span>
          <strong>TypeScript</strong>
          <span>route owner</span>
          <strong>native</strong>
          <span>Haxe boundaries</span>
          <strong>component · hook · function</strong>
        </aside>
      </section>

      <NativeBridgeDeck />

      <section className="route-proof">
        <p>02 — COEXISTENCE</p>
        <h2>One App Router. Two source languages. Zero shadow runtime.</h2>
        <Link className="route-link" href="/haxe-lab">
          Cross into the Haxe-owned signal lab <span>↗</span>
        </Link>
      </section>
    </main>
  );
}
