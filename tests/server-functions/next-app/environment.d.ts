/// <reference types="react" />
/// <reference types="react-dom" />

import type { JSX as ReactJSX } from "react";

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
  }
}

export {};
