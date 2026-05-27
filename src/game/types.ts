export type RoomType = 'start' | 'enemy' | 'shop' | 'chest' | 'exit';

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'key';
  attackBonus: number;
  defenseBonus: number;
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
  // Extensible attributes for action success checks (sneakThreshold, intimidateThreshold, etc.)
  attrs: Record<string, boolean | number>;
}

export interface ShopItem {
  item: Item;
  cost: number;
}

export type RoomContent =
  | { type: 'start' }
  | { type: 'enemy'; enemy: EnemyDefinition }
  | { type: 'shop'; items: ShopItem[] }
  | { type: 'chest'; locked: boolean; lootItem: Item | null; lootGold: number }
  | { type: 'exit' };

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
  | { type: 'enemy'; name: string; hp: number; attack: number; defense: number; goldReward: number; hasLoot: boolean }
  | { type: 'shop'; items: Array<{ id: string; name: string; cost: number; description: string }> }
  | { type: 'chest'; locked: boolean; lootDescription: string }
  | { type: 'exit' };

export type KnowledgeMap = Record<number, KnowledgeEntry>;

export interface PlayerStats {
  hp: number;
  maxHp: number;
  gold: number;
  attack: number;
  defense: number;
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
