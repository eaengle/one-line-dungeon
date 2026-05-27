import { useReducer, useCallback } from 'react';
import {
  GameState,
  LevelDefinition,
  RoomState,
  PlayerStats,
  KnowledgeMap,
  KnowledgeEntry,
  LogEntry,
  Item,
} from '../game/types';
import { LEVELS } from '../game/levels';
import { resolveCombat, predictCombat } from '../game/combat';
import { ACTION_REGISTRY, ActionContext, Effect } from '../game/actions';

const BASE_ATTACK = 3;
const BASE_DEFENSE = 0;
const BASE_DEXTERITY = 5;
const BASE_CAMOUFLAGE = 0;

let logIdCounter = 0;
function makeLog(text: string, type: LogEntry['type']): LogEntry {
  return { id: ++logIdCounter, text, type };
}

function buildKnowledge(levelDef: LevelDefinition, roomId: number): KnowledgeEntry {
  const room = levelDef.rooms[roomId];
  const c = room.content;
  switch (c.type) {
    case 'start':
      return { type: 'start' };
    case 'exit':
      return { type: 'exit' };
    case 'enemy':
      return {
        type: 'enemy',
        name: c.enemy.name,
        hp: c.enemy.hp,
        attack: c.enemy.attack,
        defense: c.enemy.defense,
        goldReward: c.enemy.goldReward,
        hasLoot: !!c.enemy.loot,
      };
    case 'shop':
      return {
        type: 'shop',
        items: c.items.map(si => ({
          id: si.item.id,
          name: si.item.name,
          cost: si.cost,
          description: si.item.description,
        })),
      };
    case 'chest':
      return {
        type: 'chest',
        locked: c.locked,
        lootDescription: c.lootItem ? c.lootItem.name : c.lootGold > 0 ? `${c.lootGold} gold` : 'empty',
      };
  }
}

function initRoomStates(levelDef: LevelDefinition): RoomState[] {
  return levelDef.rooms.map(r => ({
    roomId: r.id,
    visited: false,
    enemyHp: r.content.type === 'enemy' ? r.content.enemy.hp : 0,
    enemyDefeated: false,
    purchasedItemIds: [],
    opened: false,
    flags: {},
  }));
}

function initPlayer(levelDef: LevelDefinition): PlayerStats {
  return {
    hp: levelDef.startHp,
    maxHp: levelDef.startHp,
    gold: levelDef.startGold,
    attack: BASE_ATTACK,
    defense: BASE_DEFENSE,
    dexterity: BASE_DEXTERITY,
    camouflage: BASE_CAMOUFLAGE,
    weapon: null,
    armor: null,
    keys: 0,
    inventory: [],
    traits: {},
  };
}

function initLevel(levelDef: LevelDefinition, knowledgeMap: KnowledgeMap, attempt: number): Omit<GameState, 'levels' | 'currentLevelIndex'> {
  const startKnowledge: KnowledgeMap = { ...knowledgeMap, 0: { type: 'start' } };
  return {
    levelDef,
    roomStates: initRoomStates(levelDef),
    playerPos: 0,
    player: initPlayer(levelDef),
    phase: 'in-room',
    attemptNumber: attempt,
    log: [makeLog('You enter the dungeon...', 'system')],
    knowledgeMap: startKnowledge,
  };
}

type Action =
  | { type: 'MOVE'; direction: -1 | 1 }
  | { type: 'FIGHT' }
  | { type: 'ATTEMPT_ACTION'; actionId: string }
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'USE_POTION' }
  | { type: 'OPEN_CHEST' }
  | { type: 'RETRY' }
  | { type: 'NEXT_LEVEL' }
  | { type: 'LOAD_LEVEL'; level: LevelDefinition };

function applyEffect(state: GameState, effect: Effect, ctx: ActionContext): GameState {
  switch (effect.type) {
    case 'log': {
      const entry: LogEntry = { id: ++logIdCounter, text: effect.getText(ctx), type: effect.logType };
      return { ...state, log: [...state.log, entry] };
    }
    case 'damage_player': {
      const newHp = state.player.hp - effect.amount;
      if (newHp <= 0) return { ...state, player: { ...state.player, hp: 0 }, phase: 'dead' };
      return { ...state, player: { ...state.player, hp: newHp } };
    }
    case 'damage_player_half_combat': {
      const pred = predictCombat(state.player, { ...ctx.enemy, hp: ctx.currentEnemyHp });
      const dmg = Math.max(1, Math.ceil(pred.hpCost / 2));
      const newHp = state.player.hp - dmg;
      const dmgLog: LogEntry = { id: ++logIdCounter, text: `You take ${dmg} damage.`, type: 'combat' };
      if (newHp <= 0) return { ...state, player: { ...state.player, hp: 0 }, phase: 'dead', log: [...state.log, dmgLog] };
      return { ...state, player: { ...state.player, hp: newHp }, log: [...state.log, dmgLog] };
    }
    case 'damage_player_enemy_strike': {
      const dmg = Math.max(1, ctx.enemy.attack - state.player.defense);
      const newHp = state.player.hp - dmg;
      const dmgLog: LogEntry = { id: ++logIdCounter, text: `You take ${dmg} damage.`, type: 'combat' };
      if (newHp <= 0) return { ...state, player: { ...state.player, hp: 0 }, phase: 'dead', log: [...state.log, dmgLog] };
      return { ...state, player: { ...state.player, hp: newHp }, log: [...state.log, dmgLog] };
    }
    case 'defeat_enemy_no_reward': {
      const newRoomStates = state.roomStates.map((rs, i) =>
        i === ctx.roomIndex ? { ...rs, enemyDefeated: true, enemyHp: 0 } : rs
      );
      return { ...state, roomStates: newRoomStates };
    }
    case 'move_forward': {
      const newPos = state.playerPos + 1;
      if (newPos >= state.levelDef.rooms.length) return state;
      const room = state.levelDef.rooms[newPos];
      const newKnowledge: KnowledgeMap = state.knowledgeMap[newPos]
        ? state.knowledgeMap
        : { ...state.knowledgeMap, [newPos]: buildKnowledge(state.levelDef, newPos) };
      const newRoomStates = state.roomStates.map((rs, i) => i === newPos ? { ...rs, visited: true } : rs);
      const phase = room.content.type === 'exit' ? 'level-complete' : state.phase;
      return { ...state, playerPos: newPos, knowledgeMap: newKnowledge, roomStates: newRoomStates, phase };
    }
    case 'set_room_flag': {
      const newRoomStates = state.roomStates.map((rs, i) =>
        i === ctx.roomIndex ? { ...rs, flags: { ...rs.flags, [effect.flag]: true } } : rs
      );
      return { ...state, roomStates: newRoomStates };
    }
    case 'clear_room_flag': {
      const newRoomStates = state.roomStates.map((rs, i) => {
        if (i !== ctx.roomIndex) return rs;
        const { [effect.flag]: _removed, ...rest } = rs.flags;
        return { ...rs, flags: rest };
      });
      return { ...state, roomStates: newRoomStates };
    }
    case 'set_player_trait':
      return { ...state, player: { ...state.player, traits: { ...state.player.traits, [effect.trait]: effect.value } } };
    case 'lock_to_fight': {
      const newRoomStates = state.roomStates.map((rs, i) =>
        i === ctx.roomIndex ? { ...rs, flags: { ...rs.flags, locked_to_fight: true } } : rs
      );
      return { ...state, roomStates: newRoomStates };
    }
    default:
      return state;
  }
}

function applyEffects(state: GameState, effects: Effect[], ctx: ActionContext): GameState {
  return effects.reduce((s, effect) => applyEffect(s, effect, ctx), state);
}

function applyItem(player: PlayerStats, item: Item): PlayerStats {
  let updated = { ...player };
  if (item.type === 'weapon') {
    if (updated.weapon) {
      updated.attack -= updated.weapon.attackBonus;
      updated.dexterity -= updated.weapon.dexterityBonus;
      updated.camouflage -= updated.weapon.camouflageBonus;
    }
    updated.weapon = item;
    updated.attack += item.attackBonus;
    updated.dexterity += item.dexterityBonus;
    updated.camouflage += item.camouflageBonus;
  } else if (item.type === 'armor') {
    if (updated.armor) {
      updated.defense -= updated.armor.defenseBonus;
      updated.dexterity -= updated.armor.dexterityBonus;
      updated.camouflage -= updated.armor.camouflageBonus;
    }
    updated.armor = item;
    updated.defense += item.defenseBonus;
    updated.dexterity += item.dexterityBonus;
    updated.camouflage += item.camouflageBonus;
  } else if (item.type === 'key') {
    updated.keys += 1;
  } else {
    updated.inventory = [...updated.inventory, item];
  }
  return updated;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'MOVE': {
      const newPos = state.playerPos + action.direction;
      if (newPos < 0 || newPos >= state.levelDef.rooms.length) return state;

      // Living enemies block forward movement — must be resolved first
      if (action.direction === 1) {
        const cur = state.levelDef.rooms[state.playerPos];
        const curState = state.roomStates[state.playerPos];
        if (cur.content.type === 'enemy' && !curState.enemyDefeated) {
          return { ...state, log: [...state.log, makeLog(`The ${cur.content.enemy.name} blocks your path!`, 'info')] };
        }
      }

      // Sneaked-past enemies block retreat — they cut off the way back
      if (action.direction === -1) {
        const dest = state.levelDef.rooms[newPos];
        const destState = state.roomStates[newPos];
        if (dest.content.type === 'enemy' && !destState.enemyDefeated && destState.flags['sneaked_past']) {
          return { ...state, log: [...state.log, makeLog(`The ${dest.content.enemy.name} cut off your retreat!`, 'info')] };
        }
      }

      const room = state.levelDef.rooms[newPos];
      const alreadyKnown = !!state.knowledgeMap[newPos];

      const newKnowledgeMap: KnowledgeMap = alreadyKnown
        ? state.knowledgeMap
        : { ...state.knowledgeMap, [newPos]: buildKnowledge(state.levelDef, newPos) };

      const newRoomStates = state.roomStates.map((rs, i) =>
        i === newPos ? { ...rs, visited: true } : rs
      );

      const dirText = action.direction === 1 ? 'forward' : 'back';
      const newLog = [...state.log, makeLog(`You move ${dirText} to ${room.name}.`, 'info')];

      // Auto-trigger exit
      if (room.content.type === 'exit') {
        return {
          ...state,
          playerPos: newPos,
          phase: 'level-complete',
          knowledgeMap: newKnowledgeMap,
          roomStates: newRoomStates,
          log: [...newLog, makeLog('You escaped the dungeon!', 'system')],
        };
      }

      return {
        ...state,
        playerPos: newPos,
        phase: 'in-room',
        knowledgeMap: newKnowledgeMap,
        roomStates: newRoomStates,
        log: newLog,
      };
    }

    case 'FIGHT': {
      const room = state.levelDef.rooms[state.playerPos];
      if (room.content.type !== 'enemy') return state;
      const roomState = state.roomStates[state.playerPos];
      if (roomState.enemyDefeated) return state;

      const { playerWins, hpCost, goldGained, loot } = resolveCombat(
        state.player,
        room.content.enemy,
        roomState.enemyHp
      );

      const newHp = state.player.hp - hpCost;

      if (!playerWins) {
        return {
          ...state,
          player: { ...state.player, hp: 0 },
          phase: 'dead',
          log: [...state.log, makeLog(`You were defeated by the ${room.content.enemy.name}!`, 'death')],
        };
      }

      let updatedPlayer: PlayerStats = { ...state.player, hp: newHp, gold: state.player.gold + goldGained };
      const combatLog = [makeLog(
        `You defeated the ${room.content.enemy.name}! (-${hpCost} HP, +${goldGained} gold)`,
        'combat'
      )];

      if (loot) {
        updatedPlayer = applyItem(updatedPlayer, loot);
        combatLog.push(makeLog(`The ${room.content.enemy.name} dropped a ${loot.name}!`, 'loot'));
      }

      const newRoomStates = state.roomStates.map((rs, i) =>
        i === state.playerPos ? { ...rs, enemyDefeated: true, enemyHp: 0 } : rs
      );

      return {
        ...state,
        player: updatedPlayer,
        roomStates: newRoomStates,
        phase: 'in-room',
        log: [...state.log, ...combatLog],
      };
    }

    case 'ATTEMPT_ACTION': {
      const room = state.levelDef.rooms[state.playerPos];
      if (room.content.type !== 'enemy') return state;
      const actionDef = ACTION_REGISTRY[action.actionId];
      if (!actionDef) return state;
      const roomState = state.roomStates[state.playerPos];
      const ctx: ActionContext = {
        player: state.player,
        enemy: room.content.enemy,
        currentEnemyHp: roomState.enemyHp,
        roomState,
        roomIndex: state.playerPos,
        levelDef: state.levelDef,
      };
      if (!actionDef.canAttempt(ctx)) return state;
      const success = actionDef.checkSuccess(ctx);
      const effects = success ? actionDef.onSuccess : actionDef.onFailure;
      return applyEffects(state, effects, ctx);
    }

    case 'BUY_ITEM': {
      const room = state.levelDef.rooms[state.playerPos];
      if (room.content.type !== 'shop') return state;

      const shopItem = room.content.items.find(si => si.item.id === action.itemId);
      if (!shopItem) return state;
      if (state.player.gold < shopItem.cost) return state;
      const roomState = state.roomStates[state.playerPos];
      if (roomState.purchasedItemIds.includes(action.itemId)) return state;

      const updatedPlayer = applyItem(
        { ...state.player, gold: state.player.gold - shopItem.cost },
        shopItem.item
      );

      const newRoomStates = state.roomStates.map((rs, i) =>
        i === state.playerPos
          ? { ...rs, purchasedItemIds: [...rs.purchasedItemIds, action.itemId] }
          : rs
      );

      return {
        ...state,
        player: updatedPlayer,
        roomStates: newRoomStates,
        log: [...state.log, makeLog(`You bought the ${shopItem.item.name} for ${shopItem.cost} gold.`, 'shop')],
      };
    }

    case 'USE_POTION': {
      const itemIndex = state.player.inventory.findIndex(i => i.type === 'consumable');
      if (itemIndex === -1) return state;
      const item = state.player.inventory[itemIndex];
      const newInventory = state.player.inventory.filter((_, i) => i !== itemIndex);
      let updatedPlayer = { ...state.player, inventory: newInventory };
      let logText = '';
      if (item.hpRestore > 0) {
        updatedPlayer = { ...updatedPlayer, hp: Math.min(updatedPlayer.hp + item.hpRestore, updatedPlayer.maxHp) };
        logText = `You drink the ${item.name} and restore ${item.hpRestore} HP.`;
      }
      if (item.camouflageBonus > 0) {
        const current = Number(updatedPlayer.traits['camouflage_bonus'] ?? 0);
        updatedPlayer = {
          ...updatedPlayer,
          traits: { ...updatedPlayer.traits, camouflage_bonus: current + item.camouflageBonus },
        };
        logText = `You read the ${item.name}. Shadows embrace you (+${item.camouflageBonus} Camouflage).`;
      }
      return {
        ...state,
        player: updatedPlayer,
        log: [...state.log, makeLog(logText, 'loot')],
      };
    }

    case 'OPEN_CHEST': {
      const room = state.levelDef.rooms[state.playerPos];
      if (room.content.type !== 'chest') return state;
      const roomState = state.roomStates[state.playerPos];
      if (roomState.opened) return state;

      const chest = room.content;
      if (chest.locked && state.player.keys < 1) {
        return {
          ...state,
          log: [...state.log, makeLog('The chest is locked. You need a key.', 'info')],
        };
      }

      let updatedPlayer = chest.locked
        ? { ...state.player, keys: state.player.keys - 1 }
        : { ...state.player };

      let lootLog = 'The chest is empty.';
      if (chest.lootGold > 0) {
        updatedPlayer.gold += chest.lootGold;
        lootLog = `You find ${chest.lootGold} gold!`;
      } else if (chest.lootItem) {
        updatedPlayer = applyItem(updatedPlayer, chest.lootItem);
        lootLog = `You find a ${chest.lootItem.name}!`;
      }

      const newRoomStates = state.roomStates.map((rs, i) =>
        i === state.playerPos ? { ...rs, opened: true } : rs
      );

      return {
        ...state,
        player: updatedPlayer,
        roomStates: newRoomStates,
        log: [...state.log, makeLog(lootLog, 'loot')],
      };
    }

    case 'RETRY': {
      const freshState = initLevel(state.levelDef, state.knowledgeMap, state.attemptNumber + 1);
      return {
        ...state,
        ...freshState,
      };
    }

    case 'NEXT_LEVEL': {
      const nextIndex = state.currentLevelIndex + 1;
      if (nextIndex >= state.levels.length) {
        return { ...state, phase: 'game-complete' };
      }
      const nextLevel = state.levels[nextIndex];
      const freshState = initLevel(nextLevel, {}, 1);
      return {
        ...state,
        ...freshState,
        currentLevelIndex: nextIndex,
      };
    }

    case 'LOAD_LEVEL': {
      const newLevels = [...state.levels, action.level];
      const newIndex = newLevels.length - 1;
      const freshState = initLevel(action.level, {}, 1);
      return {
        ...state,
        ...freshState,
        levels: newLevels,
        currentLevelIndex: newIndex,
      };
    }

    default:
      return state;
  }
}

export function useGameState() {
  const firstLevel = LEVELS[0];
  const initialState: GameState = {
    ...initLevel(firstLevel, {}, 1),
    currentLevelIndex: 0,
    levels: LEVELS,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  const moveLeft = useCallback(() => dispatch({ type: 'MOVE', direction: -1 }), []);
  const moveRight = useCallback(() => dispatch({ type: 'MOVE', direction: 1 }), []);
  const fight = useCallback(() => dispatch({ type: 'FIGHT' }), []);
  const attemptAction = useCallback((actionId: string) => dispatch({ type: 'ATTEMPT_ACTION', actionId }), []);
  const buyItem = useCallback((itemId: string) => dispatch({ type: 'BUY_ITEM', itemId }), []);
  const usePotion = useCallback(() => dispatch({ type: 'USE_POTION' }), []);
  const openChest = useCallback(() => dispatch({ type: 'OPEN_CHEST' }), []);
  const retry = useCallback(() => dispatch({ type: 'RETRY' }), []);
  const nextLevel = useCallback(() => dispatch({ type: 'NEXT_LEVEL' }), []);
  const loadLevel = useCallback((level: LevelDefinition) => dispatch({ type: 'LOAD_LEVEL', level }), []);

  return { state, moveLeft, moveRight, fight, attemptAction, buyItem, usePotion, openChest, retry, nextLevel, loadLevel };
}
