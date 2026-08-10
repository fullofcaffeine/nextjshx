// Native-owned root route retained beside the generated /haxe route to prove
// that NextJsHx adoption does not claim or overwrite existing convention files.
// This separate native import lets the test ask Next for the real runtime keys.
// It is an independent check of the processor manifest used by Haxe.
import haxePageStyles from "../styles/haxe-page.module.css";

export default function Page() {
  return (
    <main
      id="native-root"
      data-css-module-keys={Object.keys(haxePageStyles).sort().join(",")}
    >
      <p>This root page remains native TypeScript.</p>
    </main>
  );
}
