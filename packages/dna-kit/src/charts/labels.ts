/**
 * Label collision resolution for slopegraphs, dumbbells and any chart that writes text at a
 * data position.
 *
 * Promoted from a month where the EU and North America ended $0.30M apart on a $14.8M scale
 * and their two-line labels overlapped into an unreadable smear. Every month so far
 * has hand-rolled some version of this; that is enough times.
 *
 * THE RULE THIS ENCODES: the MARK stays on its true value, only the TEXT moves. A label that
 * has been nudged 12px to stay legible is annotation. A mark that has been nudged is a lie.
 * Callers must keep drawing the dot at `y(value)` and use the returned position for the text
 * alone - and, when the offset is large, draw a leader line between them.
 */

/** A datum that needs a label placed near its true position. */
export type Labelled<T> = { item: T; y: number };

/**
 * Push overlapping labels apart, top to bottom, preserving order.
 *
 * Returns the resolved y for each input, in the SAME order as the input array.
 * Positions are only ever moved DOWN, so the topmost label stays where the data put it.
 *
 * @param ys      the true y position of each label
 * @param minGap  the minimum vertical distance between two label anchors, in user units
 */
export function spreadLabels(ys: number[], minGap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(ys.length);
  let prev = -Infinity;
  for (const { y, i } of order) {
    const placed = Math.max(y, prev + minGap);
    out[i] = placed;
    prev = placed;
  }
  return out;
}

/**
 * The same, centred: labels are spread apart but the GROUP keeps its original centre of mass,
 * so a cluster in the middle of a chart does not drift downwards. Prefer this when the labels
 * sit inside the plot area; prefer `spreadLabels` when they sit in a gutter with room below.
 */
export function spreadLabelsBalanced(ys: number[], minGap: number): number[] {
  const pushed = spreadLabels(ys, minGap);
  const before = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
  const after = pushed.reduce((a, b) => a + b, 0) / (pushed.length || 1);
  const shift = before - after;
  return pushed.map((y) => y + shift);
}

/**
 * Whether a label had to move far enough that it needs a leader line back to its mark.
 * Below this the eye connects them on its own; above it, draw the leader.
 */
export function needsLeader(trueY: number, placedY: number, threshold = 6): boolean {
  return Math.abs(trueY - placedY) > threshold;
}
