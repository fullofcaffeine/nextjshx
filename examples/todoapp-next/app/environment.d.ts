// Next 16 typed-route output still names global JSX while React 19 owns React.JSX.
import type { JSX as ReactJSX } from "react";

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

export {};
