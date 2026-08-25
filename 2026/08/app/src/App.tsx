import { createSignal, onMount } from "solid-js";
import { registerLiveRegion } from "@onyxdata/dna-kit";
import Dashboard from "./Dashboard";

export default function App() {
  const isPoster = () => window.location.pathname.startsWith("/poster");
  const [live, setLive] = createSignal<HTMLElement>();

  onMount(() => {
    const region = live();
    if (region) registerLiveRegion(region);
    try {
      const saved = localStorage.getItem("datadna-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch {
      // System theme remains the fallback.
    }
  });

  return (
    <div class={isPoster() ? "poster" : "live"}>
      <div ref={setLive} aria-live="polite" class="sr-only" />
      <main id="main">
        <Dashboard poster={isPoster()} />
      </main>
    </div>
  );
}
