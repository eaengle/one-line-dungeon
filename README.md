# One-Line Dungeon

A minimalist RPG where the entire dungeon is a single horizontal line.

```
[Entrance]──[Rat Hole]──[Shop]──[YOU: Vault]──[Guard Post]──[Exit]
```

Move left or right through rooms. Buy items, fight enemies, open chests — but plan carefully. The dungeon layout is fixed; your knowledge of it grows with each attempt. Die, restart, remember, adapt.

## How It Works

**The line is the whole game.** Rooms reveal their contents as you enter them. On retry, everything you discovered stays visible on the line — the puzzle is using that knowledge to plan a better run.

**Combat is deterministic — no dice.** Before you commit to a fight, the game shows you the exact outcome: how much damage you'll deal per round, how much you'll take, and whether you win or die. The challenge is having the right gear, not getting lucky.

**Dependency chains are the puzzle.** A level might have a locked chest with a weapon you need for the boss — but the key is sold in an early shop for more gold than you can spare if you also buy armor. Figure out the optimal order. Usually takes 3–5 attempts.

## Rooms

| Room | Description |
|------|-------------|
| **Enemy** | Shows combat prediction before you commit. Fight or retreat. |
| **Shop** | 2–3 items. You can't afford everything — choose wisely. |
| **Chest** | Unlocked chests open automatically. Locked ones need a Key. |
| **Exit** | Reach here to complete the level. |

## Controls

- **← Back / Forward →** buttons or click adjacent rooms to move
- **Fight** — only shown when combat is winnable; displays exact HP cost
- **Buy** — items gray out when sold or unaffordable
- **Use Potion** — bottom-right when you have one in inventory

## AI Level Generation

Levels 1–3 are handcrafted. The **✦ Generate Level** button in the header calls OpenAI (`gpt-4o-mini`) to procedurally generate a new dungeon with a coherent dependency chain, verified combat math, and a unique theme.

Select difficulty before generating:
- **Easy** — 5–6 rooms, 1 dependency, generous gold
- **Medium** — 6–8 rooms, 2 dependencies, tight gold  
- **Hard** — 8–10 rooms, 3 dependencies, minimum gold, boss enemy

## Getting Started

```bash
npm install
```

Create a `.env.local` file:

```
VITE_OPENAI_API_KEY=sk-...
```

```bash
npm run dev
```

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- OpenAI API (`gpt-4o-mini`) for level generation

## Design Decisions

This is an MVP. Several things are intentionally simple and marked for revisiting after playtesting:

- Retreat is free (no HP cost) — may change if scouting feels exploitable
- Enemies don't block movement — may change if game feels too easy
- Enemy HP persists within an attempt but resets on retry
- No trap or clue rooms yet — planned for post-MVP

## License

MIT
