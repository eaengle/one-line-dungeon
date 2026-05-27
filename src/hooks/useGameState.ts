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
import { resolveCombat } from '../game/combat';

const BASE_ATTACK = 3;
const BASE_DEFENSE = 0;

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
  }));
}

function initPlayer(levelDef: LevelDefinition): PlayerStats {
  return {
    hp: levelDef.startHp,
    maxHp: levelDef.startHp,
    gold: levelDef.startGold,
    attack: BASE_ATTACK,
    defense: BASE_DEFENSE,
    weapon: null,
    armor: null,
    keys: 0,
    inventory: [],
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
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'USE_POTION' }
  | { type: 'OPEN_CHEST' }
  | { type: 'RETRY' }
  | { type: 'NEXT_LEVEL' }
  | { type: 'LOAD_LEVEL'; level: LevelDefinition };

function applyItem(player: PlayerStats, item: Item): PlayerStats {
  let updated = { ...player };
  if (item.type === 'weapon') {
    if (updated.weapon) updated.attack -= updated.weapon.attackBonus;
    updated.weapon = item;
    updated.attack += item.attackBonus;
  } else if (item.type === 'armor') {
    if (updated.armor) updated.defense -= updated.armor.defenseBonus;
    updated.armor = item;
    updated.defense += item.defenseBonus;
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

      const room = state.levelDef.rooms[newPos];
      const roomState = state.roomStates[newPos];
      const alreadyKnown = !!state.knowledgeMap[newPos];

      const newKnowledgeMap: KnowledgeMap = alreadyKnown
        ? state.knowledgeMap
        : { ...state.knowledgeMap, [newPos]: buildKnowledge(state.levelDef, newPos) };

      const newRoomStates = state.roomStates.map((rs, i) =>
        i === newPos ? { ...rs, visited: true } : rs
      );

      const dirText = action.direction === 1 ? 'forward' : 'back';
      const newLog = [...state.log, makeLog(`You move ${dirText} to ${room.name}.`, 'info')];

      // Auto-open unlocked chests on entry
      if (room.content.type === 'chest' && !room.content.locked && !roomState.opened) {
        const chest = room.content;
        let updatedPlayer = { ...state.player };
        let lootLog = '';
        if (chest.lootGold > 0) {
          updatedPlayer.gold += chest.lootGold;
          lootLog = `You open the chest and find ${chest.lootGold} gold!`;
        } else if (chest.lootItem) {
          updatedPlayer = applyItem(updatedPlayer, chest.lootItem);
          lootLog = `You open the chest and find a ${chest.lootItem.name}!`;
        }
        return {
          ...state,
          playerPos: newPos,
          player: updatedPlayer,
          phase: 'in-room',
          knowledgeMap: newKnowledgeMap,
          roomStates: newRoomStates.map((rs, i) => i === newPos ? { ...rs, opened: true } : rs),
          log: [...newLog, makeLog(lootLog, 'loot')],
        };
      }

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
      const potionIndex = state.player.inventory.findIndex(i => i.type === 'consumable');
      if (potionIndex === -1) return state;
      const potion = state.player.inventory[potionIndex];
      const newHp = Math.min(state.player.hp + potion.hpRestore, state.player.maxHp);
      const newInventory = state.player.inventory.filter((_, i) => i !== potionIndex);
      return {
        ...state,
        player: { ...state.player, hp: newHp, inventory: newInventory },
        log: [...state.log, makeLog(`You drink the potion and restore ${potion.hpRestore} HP.`, 'loot')],
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
  const buyItem = useCallback((itemId: string) => dispatch({ type: 'BUY_ITEM', itemId }), []);
  const usePotion = useCallback(() => dispatch({ type: 'USE_POTION' }), []);
  const openChest = useCallback(() => dispatch({ type: 'OPEN_CHEST' }), []);
  const retry = useCallback(() => dispatch({ type: 'RETRY' }), []);
  const nextLevel = useCallback(() => dispatch({ type: 'NEXT_LEVEL' }), []);
  const loadLevel = useCallback((level: LevelDefinition) => dispatch({ type: 'LOAD_LEVEL', level }), []);

  return { state, moveLeft, moveRight, fight, buyItem, usePotion, openChest, retry, nextLevel, loadLevel };
}
