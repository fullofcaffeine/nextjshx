// Native-owned root route retained beside the generated /haxe route to prove
// that NextJsHx adoption does not claim or overwrite existing convention files.
export default function Page() {
  return (
    <main id="native-root">
      <p>This root page remains native TypeScript.</p>
    </main>
  );
}
