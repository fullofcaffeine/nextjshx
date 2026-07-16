// Temporary F05 proof adapter. ADR 0001 requires generated, manifest-owned
// adapters once the adapter publisher exists.
import { HelloView } from "../src-gen/app/HelloView";

export default function Page() {
  return HelloView.render();
}
