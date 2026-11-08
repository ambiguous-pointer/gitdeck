/**
 * Commit graph lane layout.
 *
 * Pure, deterministic and unit-tested. The web app renders `GraphRow`s row by
 * row into an SVG column; the server never needs to draw anything.
 *
 * Visual model (per row, normalized y: 0 = top edge, 0.5 = node center, 1 = bottom edge):
 *   - `incoming`  lanes occupied at the top edge; draw a line from y=0 to y=0.5
 *                 (only when `fromTop` is true — a fresh branch tip has no line above).
 *   - `converge`  other lanes that also pointed at this commit; draw a curve from
 *                 (fromLane, 0.5) to the node.
 *   - `outgoing`  lanes occupied at the bottom edge; draw a line from y=0.5 to y=1.
 *   - `mergeOut`  curves from the node to extra parents; draw from (fromLane, 0.5)
 *                 to (toLane, 1).
 *
 * Lane indexes are stable across rows (lanes are only freed, never compacted)
 * which guarantees the invariant: rows[i].outgoing === rows[i + 1].incoming.
 */
import type { GraphInputCommit, GraphLayout, GraphRow } from './types.js';

export const GRAPH_COLOR_COUNT = 10;

interface Lane {
  expected: string;
  color: number;
}

export function layoutGraph(commits: GraphInputCommit[]): GraphLayout {
  const present = new Set<string>();
  for (const commit of commits) present.add(commit.hash);

  const processed = new Set<string>();
  const lanes: (Lane | null)[] = [];
  const rows: GraphRow[] = [];
  let maxLane = -1;

  const occupiedColors = (): Set<number> => {
    const colors = new Set<number>();
    for (const lane of lanes) if (lane) colors.add(lane.color);
    return colors;
  };

  const pickColor = (): number => {
    const used = occupiedColors();
    for (let i = 0; i < GRAPH_COLOR_COUNT; i += 1) if (!used.has(i)) return i;
    // More concurrent lanes than palette entries: cycle deterministically.
    let next = 0;
    while (used.has(next)) next += 1;
    return next % GRAPH_COLOR_COUNT;
  };

  const firstFreeLane = (): number => {
    for (let i = 0; i < lanes.length; i += 1) if (!lanes[i]) return i;
    return lanes.length;
  };

  for (const commit of commits) {
    // --- 1. Locate the lane that owns this commit (if any). -----------------
    const waiting: number[] = [];
    for (let i = 0; i < lanes.length; i += 1) {
      const lane = lanes[i];
      if (lane && lane.expected === commit.hash) waiting.push(i);
    }

    let lane: number;
    let hasLineFromTop: boolean;
    if (waiting.length > 0) {
      lane = waiting[0]!;
      hasLineFromTop = true;
    } else {
      lane = firstFreeLane();
      hasLineFromTop = false;
      lanes[lane] = { expected: commit.hash, color: pickColor() };
    }

    const nodeColor = lanes[lane]!.color;

    // --- 2. Snapshot lanes entering the row. --------------------------------
    const incoming: GraphRow['incoming'] = [];
    for (let i = 0; i < lanes.length; i += 1) {
      const state = lanes[i];
      if (!state) continue;
      incoming.push({
        lane: i,
        color: state.color,
        fromTop: hasLineFromTop ? true : i !== lane,
      });
      if (i > maxLane) maxLane = i;
    }
    if (lane > maxLane) maxLane = lane;

    const converge: GraphRow['converge'] = waiting.slice(1).map((i) => ({
      fromLane: i,
      color: lanes[i]!.color,
    }));

    // --- 3. Free all lanes satisfied by this commit. -----------------------
    for (const index of waiting) lanes[index] = null;
    if (!hasLineFromTop) lanes[lane] = null;

    // --- 4. Wire parents (only those visible on this page). ----------------
    const outgoing: GraphRow['outgoing'] = [];
    const mergeOut: GraphRow['mergeOut'] = [];
    const visibleParents = commit.parents.filter((parent) => present.has(parent) && !processed.has(parent));

    if (visibleParents.length > 0) {
      const firstParent = visibleParents[0]!;
      lanes[lane] = { expected: firstParent, color: nodeColor };

      for (const parent of visibleParents.slice(1)) {
        let target = -1;
        for (let i = 0; i < lanes.length; i += 1) {
          const state = lanes[i];
          if (state && state.expected === parent) {
            target = i;
            break;
          }
        }
        if (target === -1) {
          target = firstFreeLane();
          lanes[target] = { expected: parent, color: pickColor() };
          if (target > maxLane) maxLane = target;
        }
        mergeOut.push({ fromLane: lane, toLane: target, color: lanes[target]!.color });
      }
    }

    // --- 5. Collect lanes leaving the row. ---------------------------------
    for (let i = 0; i < lanes.length; i += 1) {
      const state = lanes[i];
      if (!state) continue;
      outgoing.push({ lane: i, color: state.color });
      if (i > maxLane) maxLane = i;
    }

    rows.push({ hash: commit.hash, lane, color: nodeColor, incoming, converge, outgoing, mergeOut });
    processed.add(commit.hash);
  }

  return { rows, laneCount: maxLane + 1 };
}
