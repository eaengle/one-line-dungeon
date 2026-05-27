import type { PlayerStats, EnemyDefinition, RoomState, LevelDefinition, LogEntry } from './types';

// Context passed to every action check and effect resolver
export interface ActionContext {
  player: PlayerStats;
  enemy: EnemyDefinition;
  currentEnemyHp: number;
  roomState: RoomState;
  roomIndex: number;
  levelDef: LevelDefinition;
}

// Declarative effects — the reducer's applyEffect switch handles execution.
// Add new effect types here when genuinely new reducer behavior is needed.
export type Effect =
  | { type: 'log'; getText: (ctx: ActionContext) => string; logType: LogEntry['type'] }
  | { type: 'damage_player'; amount: number }
  | { type: 'damage_player_half_combat' }      // half of full fight HP cost
  | { type: 'damage_player_enemy_strike' }     // enemy deals one full attack
  | { type: 'defeat_enemy_no_reward' }         // enemy flees; no gold or loot
  | { type: 'move_forward' }
  | { type: 'set_room_flag'; flag: string }
  | { type: 'clear_room_flag'; flag: string }
  | { type: 'set_player_trait'; trait: string; value: boolean | number }
  | { type: 'lock_to_fight' };                 // hides sneak/intimidate, only fight remains

// An action is fully self-contained: it knows when it's available, whether it
// succeeds, and what happens either way. No reducer changes needed to add one.
export interface ActionDefinition {
  id: string;
  label: string;
  canAttempt: (ctx: ActionContext) => boolean;
  checkSuccess: (ctx: ActionContext) => boolean;
  onSuccess: Effect[];
  onFailure: Effect[];
}

const enemyAlive = (ctx: ActionContext) => !ctx.roomState.enemyDefeated;
const notLocked = (ctx: ActionContext) => !ctx.roomState.flags['locked_to_fight'];

export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  sneak: {
    id: 'sneak',
    label: 'Sneak',
    canAttempt: (ctx) => enemyAlive(ctx) && notLocked(ctx),
    // Succeeds when enemy HP is at or below their sneakThreshold attr.
    // Enemies with sneakThreshold=0 (default) can never be sneaked past.
    checkSuccess: (ctx) => {
      const threshold = Number(ctx.enemy.attrs['sneakThreshold'] ?? 0);
      return ctx.currentEnemyHp <= threshold;
    },
    onSuccess: [
      { type: 'log', getText: () => 'You slip past unnoticed.', logType: 'info' },
      { type: 'set_room_flag', flag: 'sneaked_past' },
      { type: 'move_forward' },
    ],
    onFailure: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy.name} hears you and strikes!`, logType: 'combat' },
      { type: 'damage_player_half_combat' },
    ],
  },

  intimidate: {
    id: 'intimidate',
    label: 'Intimidate',
    canAttempt: (ctx) => enemyAlive(ctx) && notLocked(ctx),
    // Succeeds when (playerNetDmg - enemyNetDmg) >= intimidateThreshold attr.
    // High threshold = hard to intimidate. Default 999 = never.
    checkSuccess: (ctx) => {
      const threshold = Number(ctx.enemy.attrs['intimidateThreshold'] ?? 999);
      const playerNet = Math.max(1, ctx.player.attack - ctx.enemy.defense);
      const enemyNet = Math.max(1, ctx.enemy.attack - ctx.player.defense);
      return (playerNet - enemyNet) >= threshold;
    },
    onSuccess: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy.name} backs down and flees!`, logType: 'info' },
      { type: 'defeat_enemy_no_reward' },
    ],
    onFailure: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy.name} is unimpressed and strikes back!`, logType: 'combat' },
      { type: 'damage_player_enemy_strike' },
      { type: 'lock_to_fight' },
    ],
  },
};
