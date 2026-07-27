"use client";

import { useState } from "react";

let failNextRender = false;

export default function ErrorProofPage() {
  const [, renderAgain] = useState(0);
  if (failNextRender) {
    throw new Error("RESETTABLE-HAXE-BOUNDARY");
  }
  return (
    <main id="error-proof-ready">
      <button
        id="trigger-error"
        onClick={() => {
          failNextRender = true;
          setTimeout(() => {
            failNextRender = false;
          }, 750);
          renderAgain((value) => value + 1);
        }}
      >
        Trigger boundary
      </button>
    </main>
  );
}
