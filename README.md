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
- **Deterministic outcomes, hidden information.** Every action has a fixed result based on stats — the player is never told in advance. They discover what works through trial and error.
- **Enemies lock you in.** A living enemy blocks all movement — forward and backward. You must resolve them (fight, sneak, or intimidate) to leave.
- **Sneak is one-way.** Sneaking past an enemy moves you forward and leaves the enemy alive. You can return to that room, but cannot sneak again — you must fight to clear a path forward.
- **Listen before you commit.** Listen reveals a flavor hint about the next room. It is available any time no active enemy is present.
- **Chests require a decision.** They don't auto-open. They may be trapped. Search first, then disarm or risk it. Disarm always shows — grayed out without picks. Using picks on an untapped chest wastes them.
- **Knowledge persists across attempts.** Discovered room contents are remembered. 3–5 attempts per level is the target feel.
- **All random effects are seeded at generation.** Utility rooms (mushroom, altar, rune) produce the same outcome every retry. Failure is a lesson, not bad luck.

## Player attributes

All start at a nominal value of 5 (except stealth = 0). Modified by items and effects.

| Attribute | Role |
|-----------|------|
| `strength` | Melee damage, carrying capacity |
| `dexterity` | Speed, stealth, dodge |
| `endurance` | Max HP basis, poison resistance |
| `agility` | Finesse, evasion |
| `intelligence` | Scroll effectiveness, trap disarming |
| `wisdom` | Perception, willpower, resist effects |
| `charisma` | Persuasion, intimidation, bribery |
| `luck` | Edge case outcomes |
| `perception` | Noticing hidden things, traps |
| `stealth` | Sneaking (earned via items, base 0) |
| `willpower` | Resist fear, curses, morale effects |

`attack` and `defense` are derived combat values driven by weapon/armor bonuses.

## Player states

Conditions applied to the player that affect attributes and actions. Stored in `player.traits`.

Environmental: `wet`, `frozen`, `overheated`, `muddy`, `blinded`
Afflicted: `poisoned`, `diseased`, `cursed`, `bleeding`, `stunned`
Empowered: `blessed`, `invisible`, `hasted`, `enraged`, `focused`
Mental: `charmed`, `feared`, `demoralized`, `confident`
Misc: `exhausted`, `satiated`

## Monster attributes

Every enemy has `weaknesses`, `resistances`, and `immunities` as typed arrays of `MonsterAttribute`.

| Category | Values |
|----------|--------|
| Elemental | `fire` `ice` `lightning` `poison` `holy` `dark` |
| Physical | `blunt` `slash` `pierce` |
| Status | `stun` `fear` `charm` `bleed` `sleep` `blind` `curse` |
| Special | `intimidation` `sneak` `silver` `magic` |

Enemy action thresholds live in `EnemyDefinition.attrs` (extensible bag):

| Attr | Used by |
|------|---------|
| `perception` + `alertness` | Sneak check |
| `intimidateThreshold` | Intimidate check |

## Action framework

Actions are data, not code. Adding a new action requires only a new entry in `src/game/actions.ts` — no reducer changes.

```typescript
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  my_action: {
    id: 'my_action',
    label: 'My Action',
    // showWhen controls visibility; canAttempt controls whether the button is enabled.
    // If showWhen is omitted, canAttempt controls both.
    showWhen: (ctx) => ctx.roomIndex > 0,
    canAttempt: (ctx) => ctx.enemy !== null && !ctx.roomState.enemyDefeated,
    checkSuccess: (ctx) => Number(ctx.enemy!.attrs['myThreshold'] ?? 0) > 0,
    onSuccess: [
      { type: 'log', getText: () => 'It worked!', logType: 'info' },
      { type: 'defeat_enemy_no_reward' },
    ],
    onFailure: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy!.name} shrugs it off.`, logType: 'combat' },
      { type: 'damage_player_enemy_strike' },
    ],
  },
};
```

### Current actions

| Action | Availability | Notes |
|--------|-------------|-------|
| `fight` | Enemy present | Always available against a living enemy |
| `sneak` | Enemy present, not locked, not already sneaked | dex + stealth ≥ perception + alertness; moves forward, leaves enemy alive |
| `intimidate` | Enemy present, not locked | net damage delta ≥ intimidateThreshold; enemy flees on success |
| `inspect` | Enemy present, not yet inspected | Reveals one random enemy stat (non-deterministic); locks to fight-only on use |
| `listen` | No active enemy, next room exists, once per room | Reveals a flavor hint about the next room |
| `search` | No active enemy, once per room | perception ≥ 7; may reveal trap flag |
| `disarm_trap` | Chest room, not yet disarmed, thieves' tools required (shown grayed without) | Disarms trap if present; wastes picks if not |
| `rest` | No active enemy, once per room | Restores 5 HP; hidden threat may interrupt |
| `wash` | River room + overheated | Removes overheated; may apply wet |
| `dry_off` | Fire room + wet | Removes wet; may apply overheated |
| `forage` | Bog/cave_in room, once | int+wis ≥ 12 → potion; else poisoned |

### Available effects

| Effect | Description |
|--------|-------------|
| `log` | Append a message to the game log |
| `damage_player` | Deal a fixed amount of damage |
| `damage_player_half_combat` | Deal half of what a full fight would cost |
| `damage_player_enemy_strike` | Enemy deals one full attack hit |
| `defeat_enemy_no_reward` | Enemy removed; no gold or loot |
| `move_forward` | Advance player to the next room |
| `set_room_flag` | Set a named boolean flag on the current room |
| `clear_room_flag` | Clear a named flag |
| `set_player_trait` | Set a named trait on the player (use `false` to remove) |
| `lock_to_fight` | Hides all actions except Fight for this enemy |
| `restore_hp` | Heal player up to maxHp |
| `add_item` | Add an item from ITEMS registry to inventory |
| `consume_item` | Remove one instance of an item from inventory |

### Adding a new effect type

1. Add it to the `Effect` union in `src/game/actions.ts`
2. Add a `case` for it in `applyEffect` in `src/hooks/useGameState.ts`

## Room types

33 room types are defined in `RoomType`. Effects and interactions are scaffolded with `// TODO` comments and implemented one at a time.

**Core:** `start` `enemy` `shop` `chest` `exit`

**Environmental** (apply player state on entry, optional enemy):
`river` `fire` `pit` `bog` `frozen` `spiderweb` `cave_in` `windswept` `graveyard` `barracks`

**Utility** (player opts in; seeded effect, consistent across retries):
`scroll` `seer` `forge` `altar` `healing` `mushroom` `rune` `pawn`

**Gated** (blocked without correct item or stat):
`locked_door` `chasm` `barred_gate` `dark_corridor` `magic_barrier`
`flooded_passage` `narrow_crawlway` `cursed_threshold` `pressure_plate` `checkpoint`

## Project structure

```
src/
  game/
    actions.ts        — ActionDefinition type, Effect union, ACTION_REGISTRY
    combat.ts         — predictCombat, resolveCombat
    items.ts          — item definitions
    levels.ts         — hardcoded level definitions
    levelGenerator.ts — OpenAI-powered level generator
    types.ts          — all shared types (RoomType, PlayerState, MonsterAttribute, etc.)
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
