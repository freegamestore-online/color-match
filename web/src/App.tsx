import { useState, useEffect, useRef, useCallback } from 'react';
import { GameShell, GameTopbar } from '@freegamestore/games';
import { useGameSounds } from '@freegamestore/games';

const COLS = 6;
const ROWS = 10;
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];
const CELL = 48;
const GAP = 3;
const DROP_INTERVAL = 800;

type Cell = string | null;

function createGrid(): Cell[][] {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)]!;
}

function findMatches(grid: Cell[][]): [number, number][] {
  const matched = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      const color = grid[r]![c];
      if (color && color === grid[r]![c + 1] && color === grid[r]![c + 2]) {
        matched.add(r + ',' + c);
        matched.add(r + ',' + (c + 1));
        matched.add(r + ',' + (c + 2));
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      const color = grid[r]![c];
      if (color && color === grid[r + 1]![c] && color === grid[r + 2]![c]) {
        matched.add(r + ',' + c);
        matched.add((r + 1) + ',' + c);
        matched.add((r + 2) + ',' + c);
      }
    }
  }
  return [...matched].map(s => {
    const parts = s.split(',');
    return [Number(parts[0]), Number(parts[1])] as [number, number];
  });
}

function applyGravity(grid: Cell[][]): Cell[][] {
  const next = createGrid();
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r]![c]) {
        next[write]![c] = grid[r]![c];
        write--;
      }
    }
  }
  return next;
}

export default function App() {
  const [grid, setGrid] = useState(createGrid);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [currentCol, setCurrentCol] = useState(Math.floor(COLS / 2));
  const [currentColor, setCurrentColor] = useState(randomColor);
  const [dropping, setDropping] = useState(false);
  const sounds = useGameSounds();
  const intervalRef = useRef<number | null>(null);

  const dropBlock = useCallback(() => {
    if (gameOver || dropping) return;
    setDropping(true);

    setGrid(prev => {
      const next = prev.map(r => [...r]);
      let landRow = -1;
      for (let r = 0; r < ROWS; r++) {
        if (next[r]![currentCol]) { landRow = r - 1; break; }
      }
      if (landRow === -1) landRow = ROWS - 1;
      if (landRow < 0) { setGameOver(true); return prev; }

      next[landRow]![currentCol] = currentColor;

      let g = next;
      let totalCleared = 0;
      let matches = findMatches(g);
      while (matches.length > 0) {
        totalCleared += matches.length;
        for (const [r, c] of matches) g[r]![c] = null;
        g = applyGravity(g);
        matches = findMatches(g);
      }

      if (totalCleared > 0) {
        setScore(s => s + totalCleared * 10);
        sounds.playScore();
      } else {
        sounds.playMove();
      }

      setCurrentCol(Math.floor(COLS / 2));
      setCurrentColor(randomColor());
      setDropping(false);

      if (g[0]!.some(c => c !== null)) setGameOver(true);

      return g;
    });
  }, [gameOver, dropping, currentCol, currentColor, sounds]);

  useEffect(() => {
    if (gameOver) return;
    intervalRef.current = window.setInterval(dropBlock, DROP_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [dropBlock, gameOver]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === 'ArrowLeft') setCurrentCol(c => Math.max(0, c - 1));
      else if (e.key === 'ArrowRight') setCurrentCol(c => Math.min(COLS - 1, c + 1));
      else if (e.key === 'ArrowDown' || e.key === ' ') dropBlock();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dropBlock, gameOver]);

  const restart = () => {
    setGrid(createGrid());
    setScore(0);
    setGameOver(false);
    setCurrentCol(Math.floor(COLS / 2));
    setCurrentColor(randomColor());
    setDropping(false);
  };

  const boardWidth = COLS * (CELL + GAP) - GAP;
  const boardHeight = ROWS * (CELL + GAP) - GAP;

  return (
    <GameShell topbar={<GameTopbar title="Color Match" score={score} />}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '1rem', touchAction: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Next:</span>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: currentColor, boxShadow: '0 2px 8px ' + currentColor + '60' }} />
        </div>

        <div style={{ position: 'relative', width: boardWidth, height: boardHeight, background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
          {!gameOver && (
            <div style={{
              position: 'absolute',
              left: currentCol * (CELL + GAP) - 2,
              top: -2,
              width: CELL + 4,
              height: boardHeight + 4,
              border: '2px solid ' + currentColor + '40',
              borderRadius: 10,
              pointerEvents: 'none',
            }} />
          )}
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={r * COLS + c}
                style={{
                  position: 'absolute',
                  left: c * (CELL + GAP),
                  top: r * (CELL + GAP),
                  width: CELL,
                  height: CELL,
                  borderRadius: 8,
                  background: cell || 'rgba(255,255,255,0.05)',
                  transition: 'background 0.15s',
                  boxShadow: cell ? '0 2px 8px ' + cell + '40' : 'none',
                }}
              />
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setCurrentCol(c => Math.max(0, c - 1))} style={controlBtn}>&#9664;</button>
          <button onClick={dropBlock} style={{ ...controlBtn, width: 80, background: currentColor + '30', borderColor: currentColor + '60' }}>DROP</button>
          <button onClick={() => setCurrentCol(c => Math.min(COLS - 1, c + 1))} style={controlBtn}>&#9654;</button>
        </div>

        {gameOver && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--muted)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Game Over</p>
            <button onClick={restart} style={{ ...controlBtn, width: 120, background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}>Play Again</button>
          </div>
        )}

        <p style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>Arrow keys or tap to move. Down/space to drop.</p>
      </div>
    </GameShell>
  );
}

const controlBtn: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'white', fontSize: '1.2rem', fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center',
};
