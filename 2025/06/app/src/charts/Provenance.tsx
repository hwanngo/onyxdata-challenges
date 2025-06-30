/**
 * THE PROVENANCE STRIP - this month's signature element.
 *
 * The headline metrics with their origin printed on them. Three of the four numbers every
 * competing entry puts in its KPI strip are struck through here, with the reason beside
 * them. It delivers the report's argument as a single object.
 *
 * The measured/manufactured distinction is TRIPLE-encoded - colour, a 45° hatch, and the
 * literal word - so it survives greyscale and every form of colour-vision deficiency.
 */
import { For } from "solid-js";
import type { Provenance } from "../data";

const TAG: Record<Provenance["origin"], { label: string; cls: string }> = {
  measured: { label: "Measured", cls: "pv-tag--measured" },
  derived: { label: "Derived", cls: "pv-tag--derived" },
  label: { label: "Label", cls: "pv-tag--derived" },
  partial: { label: "Partial", cls: "pv-tag--partial" },
};

export function ProvenanceStrip(props: { data: Provenance[]; poster?: boolean }) {
  return (
    <table class="provenance">
      <caption class="sr-only">
        Headline metrics and their provenance: which were measured and which were derived or
        drawn from a label.
      </caption>
      <tbody>
        <For each={props.data}>
          {(m) => {
            const t = TAG[m.origin];
            const real = m.origin === "measured";
            return (
              <tr
                class={real ? "pv-measured" : "pv-derived"}
                data-metric={`prov.${m.key}`}
                data-value={m.value}
              >
                <td class="pv-name">{m.name}</td>
                <td class="pv-value">{m.display}</td>
                <td style={{ width: "1%" }}>
                  {/* the swatch carries the hatch, so origin is legible without colour */}
                  <span
                    class={real ? "pv-swatch" : "pv-swatch hatch"}
                    style={real ? { background: "var(--accent)" } : {}}
                    aria-hidden="true"
                  />
                </td>
                <td style={{ width: "1%" }}>
                  <span class={`pv-tag ${t.cls}`}>{t.label}</span>
                </td>
                <td class="pv-why">{m.why}</td>
              </tr>
            );
          }}
        </For>
      </tbody>
    </table>
  );
}

export function provenanceTable(data: Provenance[]) {
  return {
    columns: ["Metric", "Value", "Origin", "Why"],
    rows: data.map((m) => [m.name, m.display, m.origin.toUpperCase(), m.why]),
  };
}
