import OpenAI from 'openai';
import { LevelDefinition } from './types';
import { ITEMS } from './items';

const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `You are a level designer for "One-Line Dungeon" — a minimalist planning puzzle RPG.

## Game Design Rules

The dungeon is a single horizontal line of rooms. The player moves left or right, discovering rooms one by one. The entire challenge is PLANNING: knowing what to buy, what to fight, and in what order. Levels should require 3–5 attempts to solve. The "aha moment" (realising you needed item X before enemy Y) is the core reward.

## Combat System (deterministic, no dice)

- Player base stats: 3 attack, 0 defense, 20 HP
- damage_per_round = max(1, attacker_attack - defender_defense)
- rounds_to_kill = ceil(enemy_hp / player_damage_per_round)
- hp_cost = (rounds_to_kill - 1) * enemy_damage_per_round
- Player wins if rounds_to_kill <= ceil(player_hp / enemy_damage_per_round)
- Weapons/armor from shop or chests modify player attack/defense

## Available Items

${JSON.stringify(
  Object.values(ITEMS).map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    attackBonus: i.attackBonus,
    defenseBonus: i.defenseBonus,
    hpRestore: i.hpRestore,
  })),
  null,
  2
)}

## Available Enemy Archetypes (use these stats, vary names/descriptions)

- Weak: hp 4–8, attack 2–4, defense 0, goldReward 2
- Medium: hp 10–16, attack 5–7, defense 1–2, goldReward 4–6
- Hard: hp 18–24, attack 8–10, defense 2–3, goldReward 6–10
- Boss: hp 24–32, attack 10–14, defense 3–5, goldReward 10–15

## Room Types

- start: always room 0, no interaction
- enemy: { type, enemy: { id, name, hp, attack, defense, goldReward, loot? } }
  - loot is optional — an item object the enemy drops on death
- shop: { type, items: [{ item: <item object>, cost: number }] }
  - 2–3 items; price items so tight gold forces hard choices
- chest: { type, locked: boolean, lootItem: <item object> | null, lootGold: number }
  - locked chests need the key item; use them to gate powerful items
- exit: always the last room

## Level Design Requirements

1. SOLVABILITY: there must be at least one valid path from start to exit (verify the combat math yourself before returning)
2. DEPENDENCY CHAIN: at least one non-obvious dependency (e.g. key from shop → locked chest → weapon needed for boss)
3. RESOURCE TENSION: starting gold should be tight — the player cannot buy everything, must choose
4. SCALING: harder levels have more rooms (5–9), tougher enemies, tighter gold
5. THEME: give the level a coherent name and atmosphere

## Output Format

Return ONLY valid JSON matching this TypeScript interface exactly:

interface LevelDefinition {
  id: number;
  name: string;
  description: string;  // one atmospheric sentence
  startHp: number;      // always 20
  startGold: number;    // 8–14 depending on difficulty
  rooms: Array<{
    id: number;         // 0-indexed
    name: string;       // atmospheric room name
    content: RoomContent;  // one of the types above
  }>;
}

Do not include any explanation. Return only the JSON object.`;

export async function generateLevel(levelNumber: number, difficulty: 'easy' | 'medium' | 'hard'): Promise<LevelDefinition> {
  const difficultyGuide = {
    easy: '5–6 rooms, 1 clear dependency, starting gold 12–14, enemies: weak + 1 medium',
    medium: '6–8 rooms, 2 dependencies, starting gold 10–12, enemies: weak + medium + 1 hard',
    hard: '8–10 rooms, 3 dependencies, starting gold 8–10, enemies: medium + hard + boss',
  };

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate level ${levelNumber}. Difficulty: ${difficulty} (${difficultyGuide[difficulty]}). Make it different from a standard cave — pick a unique dungeon theme.`,
      },
    ],
    temperature: 0.9,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error('No content from OpenAI');

  const parsed = JSON.parse(raw) as LevelDefinition;
  parsed.id = levelNumber;
  return parsed;
}
