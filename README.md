# One-Line Dungeon

A minimalist RPG where the entire dungeon is a single horizontal line of rooms. The puzzle is not about reflexes — it's about remembering what you discovered, planning resource allocation, and figuring out the right sequence across multiple attempts.

## Running the game

```
npm install
npm run dev
```

Requires a `.env.local` file with `VITE_OPENAI_API_KEY=<your key>` for the AI level generator. The three built-in levels work without it.

## Design principles

- **Single line, no branching.** All depth comes from resource and sequencing decisions along one fixed path.
- **Deterministic outcomes, hidden information.** Every action (fight, sneak, intimidate) has a fixed result based on stats — but the player is never told ahead of time. They discover what works through trial and error.
- **Enemies block forward movement.** You cannot pass a living enemy. You must resolve them (fight, sneak, or intimidate) to proceed. Sneaking past an enemy cuts off your retreat — they block the path back.
- **Chests require a decision.** They don't auto-open. They may be trapped.
- **Knowledge persists across attempts.** Discovered room contents are remembered. The retry loop is intentional: 3–5 attempts per level is the target feel.

## Action framework

Actions are data, not code. Adding a new action requires only a new entry in `src/game/actions.ts` — no reducer changes.

```typescript
// src/game/actions.ts
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  my_action: {
    id: 'my_action',
    label: 'My Action',
    canAttempt: (ctx) => !ctx.roomState.enemyDefeated,
    checkSuccess: (ctx) => Number(ctx.enemy.attrs['myThreshold'] ?? 0) > 0,
    onSuccess: [
      { type: 'log', getText: () => 'It worked!', logType: 'info' },
      { type: 'defeat_enemy_no_reward' },
    ],
    onFailure: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy.name} shrugs it off.`, logType: 'combat' },
      { type: 'damage_player_enemy_strike' },
    ],
  },
};
```

The action button appears automatically in the room panel when `canAttempt` returns true. No UI changes needed.

### Available effects

| Effect | Description |
|---|---|
| `log` | Append a message to the game log |
| `damage_player` | Deal a fixed amount of damage |
| `damage_player_half_combat` | Deal half of what a full fight would cost |
| `damage_player_enemy_strike` | Enemy deals one full attack hit |
| `defeat_enemy_no_reward` | Enemy is removed; no gold or loot |
| `move_forward` | Advance player to the next room |
| `set_room_flag` | Set a named boolean flag on the current room |
| `clear_room_flag` | Clear a named flag from the current room |
| `set_player_trait` | Set a named trait on the player |
| `lock_to_fight` | Hides all actions except Fight for this enemy |

### Adding a new effect type

1. Add it to the `Effect` union in `src/game/actions.ts`
2. Add a `case` for it in `applyEffect` in `src/hooks/useGameState.ts`

## Attribute system

All entities carry extensible attribute bags. New attributes cost zero boilerplate.

| Bag | Lives on | Purpose |
|---|---|---|
| `EnemyDefinition.attrs` | Enemies | Action thresholds (`sneakThreshold`, `intimidateThreshold`), special behaviours |
| `PlayerStats.traits` | Player | Status effects (`wet`, `blessed`, `invisible`, etc.) |
| `RoomState.flags` | Room instance | Per-run state (`sneaked_past`, `locked_to_fight`, `trap_armed`, etc.) |

### Current enemy attrs

| Attr | Meaning |
|---|---|
| `sneakThreshold` | Sneak succeeds if enemy's current HP is at or below this value |
| `intimidateThreshold` | Intimidate succeeds if `(playerNetDmg − enemyNetDmg) >=` this value |

## Project structure

```
src/
  game/
    actions.ts        — ActionDefinition type, Effect union, ACTION_REGISTRY
    combat.ts         — predictCombat, resolveCombat
    items.ts          — item definitions
    levels.ts         — hardcoded level definitions
    levelGenerator.ts — OpenAI-powered level generator
    types.ts          — all shared types
  hooks/
    useGameState.ts   — reducer, applyEffects engine, all game logic
  components/
    App.tsx
    DungeonLine.tsx   — the horizontal room strip
    RoomPanel.tsx     — current room actions and navigation
    PlayerStats.tsx   — HP bar, gold, equipped items
    GameLog.tsx       — scrolling event log
```

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS
- OpenAI `gpt-4o-mini` for procedural level generation
