import type { GraphRow } from '@gitdeck/shared';
import { graphColorHex } from '@/lib/palette';

export interface GraphCellProps {
  row: GraphRow | undefined;
  width: number;
  height: number;
}

export const LANE_WIDTH = 13;
export const GRAPH_PADDING = 10;
export const MIN_GRAPH_WIDTH = 84;

/** Graph column width needed to fit every lane of a layout. */
export function graphWidthFor(laneCount: number): number {
  return Math.max(MIN_GRAPH_WIDTH, GRAPH_PADDING * 2 + Math.max(0, laneCount - 1) * LANE_WIDTH + 10);
}

const NODE_RADIUS = 4.6;
const STROKE = 1.75;

/**
 * One row slice of the continuous lane graph. Rows are visually stacked with
 * no gap, and every row draws its incoming/outgoing lane stubs so the SVG
 * column reads as one continuous multi-lane graph while scrolling.
 */
export function GraphCell({ row, width, height }: GraphCellProps): JSX.Element | null {
  if (!row) return null;

  const mid = height / 2;
  const x = (lane: number): number => GRAPH_PADDING + lane * LANE_WIDTH;
  const nodeX = x(row.lane);
  const nodeColor = graphColorHex(row.color);
  const ring = 'var(--bg-surface)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block shrink-0 overflow-hidden"
      aria-hidden
      focusable="false"
    >
      {row.incoming.map((lane) =>
        lane.fromTop ? (
          <line
            key={`in-${lane.lane}`}
            x1={x(lane.lane)}
            y1={0}
            x2={x(lane.lane)}
            y2={mid}
            stroke={graphColorHex(lane.color)}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        ) : null,
      )}

      {row.converge.map((lane) => {
        const fromX = x(lane.fromLane);
        const delta = nodeX - fromX;
        return (
          <path
            key={`cv-${lane.fromLane}`}
            d={`M ${fromX} ${mid} C ${fromX + delta * 0.3} ${mid + height * 0.24}, ${fromX + delta * 0.7} ${mid + height * 0.24}, ${nodeX} ${mid}`}
            fill="none"
            stroke={graphColorHex(lane.color)}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        );
      })}

      {row.mergeOut.map((lane) => {
        const fromX = x(lane.fromLane);
        const toX = x(lane.toLane);
        return (
          <path
            key={`m-${lane.fromLane}-${lane.toLane}`}
            d={`M ${fromX} ${mid} C ${fromX} ${mid + height * 0.38}, ${toX} ${height - height * 0.18}, ${toX} ${height}`}
            fill="none"
            stroke={graphColorHex(lane.color)}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        );
      })}

      {row.outgoing.map((lane) => (
        <line
          key={`out-${lane.lane}`}
          x1={x(lane.lane)}
          y1={mid}
          x2={x(lane.lane)}
          y2={height}
          stroke={graphColorHex(lane.color)}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
      ))}

      <circle cx={nodeX} cy={mid} r={NODE_RADIUS + 1.4} fill={nodeColor} opacity={0.22} />
      <circle cx={nodeX} cy={mid} r={NODE_RADIUS} fill={nodeColor} stroke={ring} strokeWidth={1.6} />
    </svg>
  );
}
