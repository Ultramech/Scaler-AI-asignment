import { useConsole } from "../../lib/console";

/** Returns a function that shows the "not available in this demo" banner for a feature. */
export function useUnavailable() {
  const { notify } = useConsole();
  return (feature: string) => notify({ type: "info", header: `${feature} isn't available in this local Route 53 demo.` });
}
