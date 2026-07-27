import type { JSX as ReactJSX } from "react";

// Next 16's generated typed-route declarations still name global JSX.Element,
// while React 19 publishes that identity as React.JSX.Element.
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
  }
}

export {};
