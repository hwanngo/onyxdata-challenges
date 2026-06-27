import { Show, createSignal, onMount } from "solid-js";
import { registerLiveRegion } from "@onyxdata/dna-kit";
import Dashboard from "./Dashboard";

/**
 * Two routes:
 *   /        live interactive app - cross-filter, re-sort, drill, tour
 *   /poster  the submission artifact - static, 2560x1440, no live affordances
 */
export default function App() {
  const isPoster = () => window.location.pathname.startsWith("/poster");
  const [live, setLive] = createSignal<HTMLElement>();
  onMount(() => { const el = live(); if (el) registerLiveRegion(el); });
  return (
    <div>
      <Show when={!isPoster()}>
        <a class="skip-link" href="#main">Skip to main content</a>
      </Show>
      <div ref={setLive} aria-live="polite" class="sr-only" />
      <main id="main"><Dashboard poster={isPoster()} /></main>
    </div>
  );
}
