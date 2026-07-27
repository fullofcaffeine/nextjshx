import { useBridgeChannel } from "../_nextjshx/hook/4aa28d4a55e4/useBridgeChannel";

export default function InvalidServerHookPage() {
  const channel = useBridgeChannel(["server", "client"]);
  return <p>{channel.items[channel.index]}</p>;
}
