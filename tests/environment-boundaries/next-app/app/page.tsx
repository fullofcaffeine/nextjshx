import { ServerSecrets } from "../generated/environment_boundaries/positive/ServerSecrets";
import { ClientLabel } from "./client-label";

export default function Page() {
  const configured = ServerSecrets.configured();

  return (
    <main>
      <p id="server-secret-configured">
        server-secret-configured:{configured ? "yes" : "no"}
      </p>
      <ClientLabel />
    </main>
  );
}
