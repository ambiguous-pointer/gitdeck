import { describe, expect, it } from 'vitest';
import { GRAPH_COLOR_COUNT, layoutGraph } from './graph.js';
import type { GraphInputCommit } from './types.js';

function commit(hash: string, parents: string[] = []): GraphInputCommit {
  return { hash, parents };
}

/** Lanes leaving row N must enter row N + 1 (fresh tips are added on top of them). */
function expectContinuity(layout: ReturnType<typeof layoutGraph>): void {
  for (let i = 0; i < layout.rows.length - 1; i += 1) {
    const carried = layout.rows[i + 1]!.incoming
      .filter((lane) => lane.fromTop)
      .map((lane) => ({ lane: lane.lane, color: lane.color }));
    expect(layout.rows[i]!.outgoing).toEqual(carried);
    expect(layout.rows[i]!.hash).not.toBe(layout.rows[i + 1]!.hash);
  }
}

describe('layoutGraph', () => {
  it('returns an empty layout for no commits', () => {
    expect(layoutGraph([])).toEqual({ rows: [], laneCount: 0 });
  });

  it('keeps a linear history on a single lane', () => {
    const commits = [commit('c', ['b']), commit('b', ['a']), commit('a', [])];
    const layout = layoutGraph(commits);
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(layout.laneCount).toBe(1);
    expect(layout.rows[0]!.incoming).toEqual([{ lane: 0, color: 0, fromTop: false }]);
    expect(layout.rows[1]!.incoming).toEqual([{ lane: 0, color: 0, fromTop: true }]);
    expect(layout.rows[2]!.outgoing).toEqual([]);
    expectContinuity(layout);
  });

  it('fans out a merge commit into two lanes and converges again', () => {
    // m -- a -- o ; m -- b -- o
    const commits = [
      commit('m', ['a', 'b']),
      commit('a', ['o']),
      commit('b', ['o']),
      commit('o', []),
    ];
    const layout = layoutGraph(commits);
    expect(layout.rows.map((row) => row.hash)).toEqual(['m', 'a', 'b', 'o']);
    expect(layout.laneCount).toBe(2);
    // Merge row creates a second lane.
    expect(layout.rows[0]!.mergeOut).toHaveLength(1);
    expect(layout.rows[0]!.mergeOut[0]!.fromLane).toBe(0);
    expect(layout.rows[0]!.mergeOut[0]!.toLane).toBe(1);
    // Both a and b wait for o; the later one converges into o's lane.
    const oRow = layout.rows[3]!;
    expect(oRow.converge.length).toBeGreaterThanOrEqual(1);
    expectContinuity(layout);
  });

  it('starts disconnected branches with a fresh tip lane', () => {
    const commits = [
      commit('main1', ['main0']),
      commit('main0', []),
      commit('topic1', ['topic0']),
      commit('topic0', []),
    ];
    const layout = layoutGraph(commits);
    expect(layout.rows[2]!.incoming).toEqual([{ lane: 0, color: 0, fromTop: false }]);
    expect(layout.laneCount).toBe(1);
    expectContinuity(layout);
  });

  it('handles octopus merges', () => {
    const commits = [
      commit('octopus', ['a', 'b', 'c']),
      commit('a', ['base']),
      commit('b', ['base']),
      commit('c', ['base']),
      commit('base', []),
    ];
    const layout = layoutGraph(commits);
    expect(layout.rows[0]!.mergeOut).toHaveLength(2);
    expect(layout.laneCount).toBeGreaterThanOrEqual(3);
    expectContinuity(layout);
  });

  it('ignores parents that are not part of the page', () => {
    const layout = layoutGraph([commit('head', ['missing-parent']), commit('other', [])]);
    expect(layout.rows[0]!.outgoing).toEqual([]);
    expect(layout.rows[1]!.incoming).toEqual([{ lane: 0, color: 0, fromTop: false }]);
  });

  it('reuses freed lanes instead of growing forever', () => {
    const commits = [
      commit('c1', ['b1']),
      commit('b1', []),
      commit('c2', ['b2']),
      commit('b2', []),
      commit('c3', []),
    ];
    const layout = layoutGraph(commits);
    expect(layout.laneCount).toBe(1);
  });

  it('produces deterministic output and bounded colors', () => {
    const commits = [
      commit('a', ['b', 'c']),
      commit('d', ['a']),
      commit('b', ['e']),
      commit('c', ['e']),
      commit('e', []),
    ];
    const first = layoutGraph(commits);
    const second = layoutGraph(commits);
    expect(first).toEqual(second);
    const colors = new Set<number>();
    for (const row of first.rows) {
      colors.add(row.color);
      for (const lane of row.incoming) colors.add(lane.color);
    }
    for (const color of colors) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThan(GRAPH_COLOR_COUNT);
    }
  });

  it('never places two nodes on the same lane in one row', () => {
    const commits = [
      commit('h1', ['p1']),
      commit('h2', ['p2']),
      commit('p1', ['base']),
      commit('p2', ['base']),
      commit('base', []),
    ];
    const layout = layoutGraph(commits);
    expect(new Set(layout.rows.map((row) => row.hash)).size).toBe(commits.length);
    for (const row of layout.rows) {
      expect(row.incoming.some((lane) => lane.lane === row.lane)).toBe(true);
    }
  });
});
