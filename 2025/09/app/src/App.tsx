import { createSignal, onMount } from "solid-js";
import { registerLiveRegion } from "@onyxdata/dna-kit";
import Dashboard from "./Dashboard";

/**
 * Two routes:
 *   /        live app - cross-filter, the loan-to-income sweep, guided tour
 *   /poster  the submission artifact - static, 2560x1440, no live affordances
 */
export default function App() {
  const isPoster = () => window.location.pathname.startsWith("/poster");
  const [live, setLive] = createSignal<HTMLElement>();
  onMount(() => {
    const el = live();
    if (el) registerLiveRegion(el);
  });
  return (
    <div class={isPoster() ? "poster-root" : "live"}>
      <a class="skip-link" href="#main">Skip to main content</a>
      <div ref={setLive} aria-live="polite" class="sr-only" />
      <main id="main">
        <Dashboard poster={isPoster()} />
      </main>
    </div>
  );
}
