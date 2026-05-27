import { useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { DungeonLine } from './components/DungeonLine';
import { RoomPanel } from './components/RoomPanel';
import { PlayerStats } from './components/PlayerStats';
import { GameLog } from './components/GameLog';
import { generateLevel } from './game/levelGenerator';

type Difficulty = 'easy' | 'medium' | 'hard';

export function App() {
  const { state, moveLeft, moveRight, fight, buyItem, usePotion, openChest, retry, nextLevel, loadLevel } = useGameState();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  function handleRoomClick(index: number) {
    if (index === state.playerPos - 1) moveLeft();
    else if (index === state.playerPos + 1) moveRight();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const nextId = state.levels.length + 1;
      const level = await generateLevel(nextId, difficulty);
      loadLevel(level);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  const isDead = state.phase === 'dead';
  const isLevelComplete = state.phase === 'level-complete';
  const isGameComplete = state.phase === 'game-complete';

  return (
    <div className="min-h-screen flex flex-col bg-stone-950">
      {/* Header */}
      <div className="border-b border-stone-800 px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-amber-400 font-bold text-base tracking-widest uppercase">
            One-Line Dungeon
          </h1>
          <p className="text-stone-500 text-xs truncate">{state.levelDef.name} — {state.levelDef.description}</p>
        </div>

        {/* AI Generate controls */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value as Difficulty)}
            className="text-xs bg-stone-900 border border-stone-700 text-stone-300 rounded px-2 py-1"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs px-3 py-1.5 rounded border border-amber-700 text-amber-400 hover:bg-amber-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : '✦ Generate Level'}
          </button>
        </div>

        <div className="text-right shrink-0">
          <div className="text-stone-400 text-xs">Attempt</div>
          <div className="text-amber-400 font-bold text-lg">#{state.attemptNumber}</div>
        </div>
      </div>

      {genError && (
        <div className="bg-red-950/50 border-b border-red-900 px-4 py-2 text-red-400 text-xs">
          Generation error: {genError}
        </div>
      )}

      {/* Dungeon Line */}
      <div className="relative">
        <DungeonLine state={state} onRoomClick={handleRoomClick} />
        <div className="absolute top-2 left-4 text-stone-600 text-xs">
          Level {state.currentLevelIndex + 1} / {state.levels.length}
        </div>
      </div>

      {/* Terminal state overlays */}
      {isDead && (
        <div className="border-t border-red-900 bg-red-950/30 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-red-400 font-bold text-sm">You died.</p>
            <p className="text-stone-500 text-xs mt-0.5">The dungeon remembers what you found. Try again.</p>
          </div>
          <button
            onClick={retry}
            className="text-xs px-4 py-2 rounded border border-red-700 text-red-400 hover:bg-red-900 transition-colors font-bold"
          >
            Retry (Attempt #{state.attemptNumber + 1})
          </button>
        </div>
      )}

      {isLevelComplete && (
        <div className="border-t border-green-900 bg-green-950/30 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-green-400 font-bold text-sm">Level complete!</p>
            <p className="text-stone-500 text-xs mt-0.5">
              Escaped in {state.attemptNumber} {state.attemptNumber === 1 ? 'attempt' : 'attempts'}.
            </p>
          </div>
          <div className="flex gap-2">
            {state.currentLevelIndex + 1 < state.levels.length && (
              <button
                onClick={nextLevel}
                className="text-xs px-4 py-2 rounded border border-green-700 text-green-400 hover:bg-green-900 transition-colors font-bold"
              >
                Next Level →
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-xs px-4 py-2 rounded border border-amber-700 text-amber-400 hover:bg-amber-950 transition-colors font-bold disabled:opacity-50"
            >
              {generating ? 'Generating...' : '✦ Generate New'}
            </button>
          </div>
        </div>
      )}

      {isGameComplete && (
        <div className="border-t border-amber-800 bg-amber-950/30 px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-amber-400 font-bold text-sm">You conquered all three dungeons.</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs px-4 py-2 rounded border border-amber-700 text-amber-400 hover:bg-amber-950 transition-colors font-bold disabled:opacity-50"
          >
            {generating ? 'Generating...' : '✦ Generate New Level'}
          </button>
        </div>
      )}

      {/* Room Panel */}
      {!isDead && !isLevelComplete && !isGameComplete && (
        <RoomPanel
          state={state}
          onFight={fight}
          onBuyItem={buyItem}
          onOpenChest={openChest}
          onMoveLeft={moveLeft}
          onMoveRight={moveRight}
        />
      )}

      <div className="flex-1" />

      <PlayerStats player={state.player} onUsePotion={usePotion} />
      <GameLog entries={state.log} />
    </div>
  );
}
