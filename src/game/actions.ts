import type { PlayerStats, EnemyDefinition, RoomState, LevelDefinition, LogEntry } from './types';

// Context passed to every action check and effect resolver
export interface ActionContext {
  player: PlayerStats;
  enemy: EnemyDefinition | null;
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
  | { type: 'lock_to_fight' }                  // hides sneak/intimidate, only fight remains
  | { type: 'restore_hp'; amount: number }     // heal up to maxHp
  | { type: 'add_item'; itemId: string }       // add item from ITEMS registry to inventory
  | { type: 'consume_item'; itemId: string };  // remove one instance of item from inventory

// An action is fully self-contained: it knows when it's available, whether it
// succeeds, and what happens either way. No reducer changes needed to add one.
export interface ActionDefinition {
  id: string;
  label: string;
  // showWhen controls visibility; canAttempt controls whether the button is enabled.
  // If showWhen is absent, canAttempt controls both.
  showWhen?: (ctx: ActionContext) => boolean;
  canAttempt: (ctx: ActionContext) => boolean;
  checkSuccess: (ctx: ActionContext) => boolean;
  onSuccess: Effect[];
  onFailure: Effect[];
}

const enemyAlive = (ctx: ActionContext) => ctx.enemy !== null && !ctx.roomState.enemyDefeated;

function inspectReveal(ctx: ActionContext): string {
  const e = ctx.enemy!;
  const pool: string[] = [
    `Its attack is ${e.attack}.`,
    `Its defense is ${e.defense}.`,
    `It has ${e.hp} HP.`,
    ...Object.entries(e.attrs).map(([k, v]) => {
      switch (k) {
        case 'perception':          return `Its perception is ${v}.`;
        case 'alertness':           return `Its alertness is ${v}.`;
        case 'intimidateThreshold': return Number(v) >= 999 ? 'It cannot be intimidated.' : `Its intimidate threshold is ${v}.`;
        case 'inspectDifficulty':   return null;
        default:                    return `${k}: ${v}`;
      }
    }).filter((s): s is string => s !== null),
  ];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return `You study the ${e.name}. ${pick}`;
}

function listenHint(ctx: ActionContext): string {
  const next = ctx.levelDef.rooms[ctx.roomIndex + 1];
  if (!next) return 'You hear nothing — the dungeon ends here.';
  const c = next.content;
  switch (c.type) {
    case 'enemy':    return `You press your ear to the wall. Something stirs — the ${c.enemy.name} is close.`;
    case 'shop':     return 'You hear the clink of coins and a low voice muttering prices.';
    case 'chest':    return 'The next room is quiet — only the creak of old wood.';
    case 'exit':     return 'A cool draft brushes past you. The exit is just ahead.';
    case 'river':    return 'You hear rushing water from the next room.';
    case 'fire':     return 'Heat seeps through the wall. Something burns ahead.';
    case 'bog':      return 'A foul, damp stench drifts from ahead.';
    case 'frozen':   return 'An icy chill bleeds through the stone. The next room is freezing.';
    case 'pit':      return 'Your voice echoes strangely — a drop ahead.';
    case 'spiderweb': return 'You hear a faint chittering from the darkness ahead.';
    case 'cave_in':  return 'Dust and loose pebbles trickle past the threshold — unstable ground ahead.';
    case 'windswept': return 'A sharp gust cuts through the gap — the next room is open to the wind.';
    case 'graveyard': return 'An unnatural silence falls beyond the door. You smell turned earth.';
    case 'barracks': return 'You hear slow, heavy breathing — something sleeps in the next room.';
    default:         return 'You hear indistinct sounds from the next room but cannot make them out.';
  }
}
const notLocked = (ctx: ActionContext) => !ctx.roomState.flags['locked_to_fight'];
const roomType = (ctx: ActionContext) => ctx.levelDef.rooms[ctx.roomIndex].content.type;

export const ACTION_REGISTRY: Record<string, ActionDefinition> = {

  // ── Combat ───────────────────────────────────────────────────────────────

  sneak: {
    id: 'sneak',
    label: 'Sneak',
    canAttempt: (ctx) => enemyAlive(ctx) && notLocked(ctx) && !ctx.roomState.flags['sneak_disabled'] && !ctx.roomState.flags['sneaked_past'],
    // Succeeds when player's sneak score (dexterity + stealth + traits bonus) >= enemy's detect score (perception + alertness).
    checkSuccess: (ctx) => {
      const traitBonus = Number(ctx.player.traits['stealth_bonus'] ?? 0);
      const sneakScore = ctx.player.dexterity + ctx.player.stealth + traitBonus;
      const detectScore = Number(ctx.enemy!.attrs['perception'] ?? 5) + Number(ctx.enemy!.attrs['alertness'] ?? 5);
      return sneakScore >= detectScore;
    },
    onSuccess: [
      { type: 'log', getText: () => 'You slip past unnoticed.', logType: 'info' },
      { type: 'set_room_flag', flag: 'sneaked_past' },
      { type: 'move_forward' },
    ],
    onFailure: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy!.name} spots you and strikes!`, logType: 'combat' },
      { type: 'damage_player_half_combat' },
      { type: 'set_room_flag', flag: 'sneak_attempted' },
    ],
  },

  intimidate: {
    id: 'intimidate',
    label: 'Intimidate',
    canAttempt: (ctx) => enemyAlive(ctx) && notLocked(ctx),
    // Succeeds when (playerNetDmg - enemyNetDmg) >= intimidateThreshold attr.
    // High threshold = hard to intimidate. Default 999 = never.
    checkSuccess: (ctx) => {
      const threshold = Number(ctx.enemy!.attrs['intimidateThreshold'] ?? 999);
      const playerNet = Math.max(1, ctx.player.attack - ctx.enemy!.defense);
      const enemyNet = Math.max(1, ctx.enemy!.attack - ctx.player.defense);
      return (playerNet - enemyNet) >= threshold;
    },
    onSuccess: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy!.name} backs down and flees!`, logType: 'info' },
      { type: 'defeat_enemy_no_reward' },
    ],
    onFailure: [
      { type: 'log', getText: (ctx) => `The ${ctx.enemy!.name} is unimpressed and strikes back!`, logType: 'combat' },
      { type: 'damage_player_enemy_strike' },
      { type: 'lock_to_fight' },
    ],
  },

  // ── Scouting ─────────────────────────────────────────────────────────────

  listen: {
    id: 'listen',
    label: 'Listen',
    // Available from any room except the last; once per room. Reveals a hint about the next room.
    canAttempt: (ctx) => !enemyAlive(ctx) && !ctx.roomState.flags['listened'] && ctx.roomIndex < ctx.levelDef.rooms.length - 1,
    checkSuccess: () => true,
    onSuccess: [
      { type: 'log', getText: (ctx) => listenHint(ctx), logType: 'info' },
      { type: 'set_room_flag', flag: 'listened' },
    ],
    onFailure: [],
  },

  inspect: {
    id: 'inspect',
    label: 'Inspect',
    // Available before sneak is attempted; disabled once sneak has been tried or inspect already used.
    canAttempt: (ctx) => enemyAlive(ctx) && !ctx.roomState.flags['inspect_used'],
    checkSuccess: () => true,
    onSuccess: [
      { type: 'log', getText: (ctx) => inspectReveal(ctx), logType: 'info' },
      { type: 'set_room_flag', flag: 'inspect_used' },
      { type: 'lock_to_fight' },
    ],
    onFailure: [],
  },

  // ── Room Interaction ──────────────────────────────────────────────────────

  search: {
    id: 'search',
    label: 'Search',
    canAttempt: (ctx) => !enemyAlive(ctx) && !ctx.roomState.flags['searched'],
    // TODO: if room has 'search_triggers_trap' flag (set at generation), skip check and trigger trap immediately.
    // perception >= searchDifficulty (TODO: add to room definition; default 7).
    checkSuccess: (ctx) => ctx.player.perception >= 7,
    onSuccess: [
      // TODO: reveal hidden item or confirm trap status from room definition
      { type: 'log', getText: () => 'You search carefully and find something useful.', logType: 'loot' },
      { type: 'set_room_flag', flag: 'searched' },
    ],
    onFailure: [
      // TODO: if room has 'search_triggers_trap' flag, apply trap state here instead
      { type: 'log', getText: () => 'You find nothing of note.', logType: 'info' },
      { type: 'set_room_flag', flag: 'searched' },
    ],
  },

  disarm_trap: {
    id: 'disarm_trap',
    label: 'Disarm Trap',
    showWhen: (ctx) => roomType(ctx) === 'chest' && !ctx.roomState.opened && !ctx.roomState.flags['trap_disarmed'],
    canAttempt: (ctx) =>
      roomType(ctx) === 'chest' &&
      !ctx.roomState.opened &&
      !ctx.roomState.flags['trap_disarmed'] &&
      ctx.player.inventory.some(i => i.id === 'thieves_tools'),
    // Success when a trap is actually present (revealed by Search).
    // Failure means no trap — picks are consumed but nothing happens.
    checkSuccess: (ctx) => !!ctx.roomState.flags['trap_revealed'],
    onSuccess: [
      { type: 'log', getText: () => 'You carefully disarm the trap. The chest is safe to open.', logType: 'info' },
      { type: 'set_room_flag', flag: 'trap_disarmed' },
      { type: 'consume_item', itemId: 'thieves_tools' },
    ],
    onFailure: [
      { type: 'log', getText: () => 'You probe every hinge and latch — no trap. Your picks are spent.', logType: 'info' },
      { type: 'set_room_flag', flag: 'trap_disarmed' },
      { type: 'consume_item', itemId: 'thieves_tools' },
    ],
  },

  rest: {
    id: 'rest',
    label: 'Rest',
    // Only in non-enemy rooms; once per room.
    canAttempt: (ctx) => roomType(ctx) !== 'enemy' && !ctx.roomState.flags['rested'],
    // Room is safe if no 'hidden_threat' flag set at generation.
    checkSuccess: (ctx) => !ctx.roomState.flags['hidden_threat'],
    onSuccess: [
      { type: 'log', getText: () => 'You rest and recover 5 HP.', logType: 'info' },
      { type: 'restore_hp', amount: 5 },
      { type: 'set_room_flag', flag: 'rested' },
    ],
    onFailure: [
      // TODO: spawn hidden enemy — needs new reducer action; for now just penalises with a log
      { type: 'log', getText: () => 'Something lurks here! You are caught off guard.', logType: 'combat' },
      { type: 'set_room_flag', flag: 'rested' },
    ],
  },

  // ── Environmental ─────────────────────────────────────────────────────────

  wash: {
    id: 'wash',
    label: 'Wash',
    // Only in river room when overheated.
    canAttempt: (ctx) => roomType(ctx) === 'river' && !!ctx.player.traits['overheated'],
    // wisdom >= 6 to cool off without getting soaked.
    checkSuccess: (ctx) => ctx.player.wisdom >= 6,
    onSuccess: [
      { type: 'log', getText: () => 'You cool off in the river. Overheated removed.', logType: 'info' },
      { type: 'set_player_trait', trait: 'overheated', value: false },
    ],
    onFailure: [
      { type: 'log', getText: () => 'You cool off but get completely soaked in the process.', logType: 'info' },
      { type: 'set_player_trait', trait: 'overheated', value: false },
      { type: 'set_player_trait', trait: 'wet', value: true },
    ],
  },

  dry_off: {
    id: 'dry_off',
    label: 'Dry Off',
    // Only in fire room when wet.
    canAttempt: (ctx) => roomType(ctx) === 'fire' && !!ctx.player.traits['wet'],
    // wisdom >= 6 to dry off without overheating.
    checkSuccess: (ctx) => ctx.player.wisdom >= 6,
    onSuccess: [
      { type: 'log', getText: () => 'You dry off by the flames. Wet removed.', logType: 'info' },
      { type: 'set_player_trait', trait: 'wet', value: false },
    ],
    onFailure: [
      { type: 'log', getText: () => 'You dry off but linger too long near the flames.', logType: 'info' },
      { type: 'set_player_trait', trait: 'wet', value: false },
      { type: 'set_player_trait', trait: 'overheated', value: true },
    ],
  },

  forage: {
    id: 'forage',
    label: 'Forage',
    // Only in bog or cave_in rooms; once per room.
    canAttempt: (ctx) => (roomType(ctx) === 'bog' || roomType(ctx) === 'cave_in') && !ctx.roomState.flags['foraged'],
    // intelligence + wisdom >= 12 to identify safe plants (requires attribute investment).
    checkSuccess: (ctx) => ctx.player.intelligence + ctx.player.wisdom >= 12,
    onSuccess: [
      { type: 'log', getText: () => 'You find useful herbs and brew a basic potion.', logType: 'loot' },
      { type: 'add_item', itemId: 'potion' },
      { type: 'set_room_flag', flag: 'foraged' },
    ],
    onFailure: [
      { type: 'log', getText: () => 'You eat something toxic. Poisoned!', logType: 'combat' },
      { type: 'set_player_trait', trait: 'poisoned', value: true },
      { type: 'set_room_flag', flag: 'foraged' },
    ],
  },

};
