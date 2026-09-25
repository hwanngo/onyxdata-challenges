import { createSignal, onMount } from "solid-js";
import { registerLiveRegion } from "@onyxdata/dna-kit";
import Dashboard from "./Dashboard";

export default function App() {
  const isPoster = window.location.pathname === "/poster" || window.location.pathname.endsWith("/poster/");
  const [liveRegion, setLiveRegion] = createSignal<HTMLElement>();

  onMount(() => {
    const region = liveRegion();
    if (region) registerLiveRegion(region);
  });

  return (
    <div class={isPoster ? "poster" : "live"}>
      <div ref={setLiveRegion} aria-live="polite" class="sr-only" />
      <Dashboard poster={isPoster} />
    </div>
  );
}
