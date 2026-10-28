import Dashboard from "./Dashboard";

export default function App() {
  const isPoster = window.location.pathname === "/poster" || window.location.pathname.endsWith("/poster/");
  return (
    <div class={isPoster ? "poster" : "live"}>
      <Dashboard poster={isPoster} />
    </div>
  );
}
