/**
 * Pure undo/redo history helpers mirrored from store.ts commit/undo/redo.
 * Kept free of React Native imports so Jest can exercise the stateful edge cases.
 */

type Snapshot = { nodes: string[]; edges: string[] };
type History = { past: Snapshot[]; future: Snapshot[] };

function commit(history: History, current: Snapshot): History {
  const top = history.past[history.past.length - 1];
  if (top && top.nodes === current.nodes && top.edges === current.edges) return history;
  return { past: [...history.past, current].slice(-50), future: [] };
}

function undo(
  history: History,
  current: Snapshot,
): { history: History; current: Snapshot } | null {
  const prev = history.past[history.past.length - 1];
  if (!prev) return null;
  return {
    current: prev,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current].slice(-50),
    },
  };
}

function redo(
  history: History,
  current: Snapshot,
): { history: History; current: Snapshot } | null {
  const next = history.future[history.future.length - 1];
  if (!next) return null;
  return {
    current: next,
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
    },
  };
}

describe('canvas history logic', () => {
  it('undo restores previous snapshot and enables redo', () => {
    let history: History = { past: [], future: [] };
    let current: Snapshot = { nodes: ['a'], edges: [] };
    history = commit(history, current);
    current = { nodes: ['a', 'b'], edges: ['e1'] };

    const stepped = undo(history, current);
    expect(stepped).not.toBeNull();
    expect(stepped!.current.nodes).toEqual(['a']);
    expect(stepped!.history.future).toHaveLength(1);

    const redone = redo(stepped!.history, stepped!.current);
    expect(redone!.current.nodes).toEqual(['a', 'b']);
    expect(redone!.history.future).toHaveLength(0);
  });

  it('skips duplicate commits of the same references', () => {
    const snap: Snapshot = { nodes: ['x'], edges: [] };
    let history: History = { past: [], future: [] };
    history = commit(history, snap);
    history = commit(history, snap);
    expect(history.past).toHaveLength(1);
  });

  it('caps past at 50 entries', () => {
    let history: History = { past: [], future: [] };
    for (let i = 0; i < 60; i++) {
      history = commit(history, { nodes: [`n${i}`], edges: [] });
    }
    expect(history.past).toHaveLength(50);
    expect(history.past[0].nodes).toEqual(['n10']);
  });
});
