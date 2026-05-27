export type RoomType =
  // Core
  | 'start' | 'enemy' | 'shop' | 'chest' | 'exit'
  // Environmental — apply player state on entry, optional enemy
  | 'river' | 'fire' | 'pit' | 'bog' | 'frozen' | 'spiderweb' | 'cave_in' | 'windswept' | 'graveyard' | 'barracks'
  // Utility — player opts in; seeded random effect, consistent across retries
  | 'scroll' | 'seer' | 'forge' | 'altar' | 'healing' | 'mushroom' | 'rune' | 'pawn'
  // Gated — blocked without correct item or condition
  | 'locked_door' | 'chasm' | 'barred_gate' | 'dark_corridor' | 'magic_barrier'
  | 'flooded_passage' | 'narrow_crawlway' | 'cursed_threshold' | 'pressure_plate' | 'checkpoint';

// Elemental damage types
export type ElementalAttribute = 'fire' | 'ice' | 'lightning' | 'poison' | 'holy' | 'dark';

// Physical damage types
export type PhysicalAttribute = 'blunt' | 'slash' | 'pierce';

// Status effect types
export type StatusAttribute = 'stun' | 'fear' | 'charm' | 'bleed' | 'sleep' | 'blind' | 'curse';

// Behavioral / special types
export type SpecialAttribute = 'intimidation' | 'sneak' | 'silver' | 'magic';

export type MonsterAttribute = ElementalAttribute | PhysicalAttribute | StatusAttribute | SpecialAttribute;

// Player states — conditions applied to the player that affect attributes/actions
export type PlayerState =
  // Environmental
  | 'wet' | 'frozen' | 'overheated' | 'muddy' | 'blinded'
  // Afflicted
  | 'poisoned' | 'diseased' | 'cursed' | 'bleeding' | 'stunned'
  // Empowered
  | 'blessed' | 'invisible' | 'hasted' | 'enraged' | 'focused'
  // Mental / Social
  | 'charmed' | 'feared' | 'demoralized' | 'confident'
  // Misc
  | 'exhausted' | 'satiated';

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'key';
  attackBonus: number;
  defenseBonus: number;
  dexterityBonus: number;
  stealthBonus: number;
  hpRestore: number;
  description: string;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  goldReward: number;
  loot?: Item;
  weaknesses: MonsterAttribute[];
  resistances: MonsterAttribute[];
  immunities: MonsterAttribute[];
  // Extensible attributes for action success checks (sneakThreshold, intimidateThreshold, etc.)
  attrs: Record<string, boolean | number>;
}

export interface ShopItem {
  item: Item;
  cost: number;
}

export type RoomContent =
  // ── Core ─────────────────────────────────────────────────────────────────
  | { type: 'start' }
  | { type: 'exit' }
  | { type: 'enemy'; enemy: EnemyDefinition }
  | { type: 'shop'; items: ShopItem[] }
  | { type: 'chest'; locked: boolean; lootItem: Item | null; lootGold: number }

  // ── Environmental ─────────────────────────────────────────────────────────
  // Applies a player state on entry; enemy is optional and inherits room conditions.
  // TODO river: applies Wet; lightning damage amplified, fire damage reduced; enemy may be amphibian
  | { type: 'river'; enemy?: EnemyDefinition }
  // TODO fire: applies Overheated; fire-weak enemies take bonus damage; fire-resistant enemies heal
  | { type: 'fire'; enemy?: EnemyDefinition }
  // TODO pit: applies Exhausted on entry; items/enemies may be below; rope/hook may be needed
  | { type: 'pit'; enemy?: EnemyDefinition }
  // TODO bog: applies Poisoned + Muddy; stealth/agility penalized; enemies may be bog-adapted
  | { type: 'bog'; enemy?: EnemyDefinition }
  // TODO frozen: applies Frozen; ice-weak enemies vulnerable to blunt (shatter); fire items may help
  | { type: 'frozen'; enemy?: EnemyDefinition }
  // TODO spiderweb: applies Muddy; optional spider enemy; stealth harder, escape harder
  | { type: 'spiderweb'; enemy?: EnemyDefinition }
  // TODO cave_in: applies Exhausted; passage blocked until strength/item check passes; may hide loot
  | { type: 'cave_in'; enemy?: EnemyDefinition }
  // TODO windswept: stealth penalized; pierce/ranged attacks buffed; may blow items around
  | { type: 'windswept'; enemy?: EnemyDefinition }
  // TODO graveyard: dark environment; undead enemies likely; holy items may spawn; dark amplified
  | { type: 'graveyard'; enemy?: EnemyDefinition }
  // TODO barracks: multiple enemies sleeping; sneak past all or wake and fight the group
  | { type: 'barracks'; enemies: EnemyDefinition[] }

  // ── Utility ───────────────────────────────────────────────────────────────
  // Player opts in to interact. Effect is seeded at level creation — same result every retry.
  // TODO scroll: spend gold to reveal contents of N upcoming rooms
  | { type: 'scroll'; cost: number; seed: number }
  // TODO seer: spend gold for insight — enemy weaknesses, room hazards, or chest contents ahead
  | { type: 'seer'; cost: number; seed: number }
  // TODO forge: spend gold to permanently increase attack or defense on equipped weapon/armor
  | { type: 'forge'; cost: number }
  // TODO altar: spend gold or offer an item; seeded outcome is blessed or cursed; state persists
  | { type: 'altar'; cost: number; seed: number }
  // TODO healing: spend gold to restore a fixed or scaled amount of HP
  | { type: 'healing'; cost: number }
  // TODO mushroom: free to interact; seeded outcome is a random stat buff or debuff
  | { type: 'mushroom'; seed: number }
  // TODO rune: free to interact; seeded outcome permanently modifies one player attribute up or down
  | { type: 'rune'; seed: number }
  // TODO pawn: sell any inventory item for a fraction of its value; no cost to enter
  | { type: 'pawn' }

  // ── Gated ─────────────────────────────────────────────────────────────────
  // Passage blocked without the required item or condition. Fallback noted per type.
  // TODO locked_door: requires key item; no key = hard blocked
  | { type: 'locked_door' }
  // TODO chasm: requires rope or grappling hook item; no item = hard blocked
  | { type: 'chasm' }
  // TODO barred_gate: requires crowbar item or strength >= threshold; else hard blocked
  | { type: 'barred_gate'; strengthThreshold: number }
  // TODO dark_corridor: requires torch item to navigate safely; without one applies Blinded
  | { type: 'dark_corridor' }
  // TODO magic_barrier: requires scroll or arcane item to dispel; else hard blocked
  | { type: 'magic_barrier' }
  // TODO flooded_passage: requires float item or endurance >= threshold; always applies Wet
  | { type: 'flooded_passage'; enduranceThreshold: number }
  // TODO narrow_crawlway: requires agility >= threshold or low encumbrance; else hard blocked
  | { type: 'narrow_crawlway'; agilityThreshold: number }
  // TODO cursed_threshold: requires Blessed state or holy item; without one applies Cursed
  | { type: 'cursed_threshold' }
  // TODO pressure_plate: requires agility >= threshold or disarm item; without one applies Stunned
  | { type: 'pressure_plate'; agilityThreshold: number }
  // TODO checkpoint: pass with disguise item, gold bribe, or charisma >= threshold; else fight
  | { type: 'checkpoint'; bribeCost: number; charismaThreshold: number };

export interface RoomDefinition {
  id: number;
  name: string;
  content: RoomContent;
}

export interface LevelDefinition {
  id: number;
  name: string;
  description: string;
  rooms: RoomDefinition[];
  startHp: number;
  startGold: number;
}

export interface RoomState {
  roomId: number;
  visited: boolean;
  enemyHp: number;
  enemyDefeated: boolean;
  purchasedItemIds: string[];
  opened: boolean;
  // Extensible per-room state flags (sneaked_past, locked_to_fight, etc.)
  flags: Record<string, boolean>;
}

export type KnowledgeEntry =
  | { type: 'start' }
  | { type: 'exit' }
  | { type: 'enemy'; name: string; hp: number; attack: number; defense: number; goldReward: number; hasLoot: boolean }
  | { type: 'shop'; items: Array<{ id: string; name: string; cost: number; description: string }> }
  | { type: 'chest'; locked: boolean; lootDescription: string }
  // New room types record a short description on first visit; detail added per type when implemented
  | { type: Exclude<RoomType, 'start' | 'exit' | 'enemy' | 'shop' | 'chest'>; description: string };

export type KnowledgeMap = Record<number, KnowledgeEntry>;

export interface PlayerStats {
  hp: number;
  maxHp: number;
  gold: number;
  // Combat derived stats (modified by weapon/armor equip bonuses)
  attack: number;
  defense: number;
  // Core attributes — nominal starting values, modified by items/effects
  strength: number;
  dexterity: number;
  endurance: number;
  agility: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  luck: number;
  perception: number;
  stealth: number;
  willpower: number;
  weapon: Item | null;
  armor: Item | null;
  keys: number;
  inventory: Item[];
  // Extensible player state (wet, blessed, invisible, etc.)
  traits: Record<string, boolean | number>;
}

export interface CombatPrediction {
  playerDamagePerRound: number;
  enemyDamagePerRound: number;
  roundsToKillEnemy: number;
  roundsUntilPlayerDeath: number;
  playerWins: boolean;
  hpCost: number;
}

export type GamePhase = 'exploring' | 'in-room' | 'dead' | 'level-complete' | 'game-complete';

export interface LogEntry {
  id: number;
  text: string;
  type: 'info' | 'combat' | 'loot' | 'death' | 'shop' | 'system';
}

export interface GameState {
  levelDef: LevelDefinition;
  roomStates: RoomState[];
  playerPos: number;
  player: PlayerStats;
  phase: GamePhase;
  attemptNumber: number;
  log: LogEntry[];
  knowledgeMap: KnowledgeMap;
  currentLevelIndex: number;
  levels: LevelDefinition[];
}
