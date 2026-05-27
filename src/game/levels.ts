import { LevelDefinition } from './types';
import { ITEMS } from './items';

export const LEVELS: LevelDefinition[] = [
  {
    id: 1,
    name: "The Rat's Den",
    description: 'A simple dungeon. Something lurks at the end.',
    startHp: 20,
    startGold: 10,
    rooms: [
      {
        id: 0,
        name: 'Entrance',
        content: { type: 'start' },
      },
      {
        id: 1,
        name: 'Rat Hole',
        content: {
          type: 'enemy',
          enemy: { id: 'rat', name: 'Giant Rat', hp: 6, attack: 3, defense: 0, goldReward: 2,
            attrs: { sneakThreshold: 6, intimidateThreshold: 0 } },
        },
      },
      {
        id: 2,
        name: "Merchant's Alcove",
        content: {
          type: 'shop',
          items: [
            { item: ITEMS.sword, cost: 8 },
            { item: ITEMS.dagger, cost: 5 },
            { item: ITEMS.potion, cost: 4 },
          ],
        },
      },
      {
        id: 3,
        name: 'Hidden Cache',
        content: { type: 'chest', locked: false, lootItem: null, lootGold: 5 },
      },
      {
        id: 4,
        name: 'Guard Post',
        content: {
          type: 'enemy',
          enemy: { id: 'goblin', name: 'Goblin Guard', hp: 14, attack: 6, defense: 1, goldReward: 4,
            attrs: { sneakThreshold: 4, intimidateThreshold: 3 } },
        },
      },
      {
        id: 5,
        name: 'Exit',
        content: { type: 'exit' },
      },
    ],
  },
  {
    id: 2,
    name: 'The Locked Vault',
    description: 'Riches lie within — if you have the right tools.',
    startHp: 20,
    startGold: 12,
    rooms: [
      {
        id: 0,
        name: 'Entrance',
        content: { type: 'start' },
      },
      {
        id: 1,
        name: 'Supply Room',
        content: {
          type: 'shop',
          items: [
            { item: ITEMS.key, cost: 3 },
            { item: ITEMS.shield, cost: 6 },
            { item: ITEMS.potion, cost: 4 },
          ],
        },
      },
      {
        id: 2,
        name: 'Crypt',
        content: {
          type: 'enemy',
          enemy: { id: 'skeleton', name: 'Skeleton', hp: 18, attack: 8, defense: 2, goldReward: 6,
            attrs: { sneakThreshold: 0, intimidateThreshold: 8 } },
        },
      },
      {
        id: 3,
        name: 'Vault',
        content: { type: 'chest', locked: true, lootItem: ITEMS.sword, lootGold: 0 },
      },
      {
        id: 4,
        name: 'Guard Room',
        content: {
          type: 'enemy',
          enemy: { id: 'goblin', name: 'Goblin Brute', hp: 14, attack: 6, defense: 1, goldReward: 4,
            attrs: { sneakThreshold: 4, intimidateThreshold: 3 } },
        },
      },
      {
        id: 5,
        name: 'Exit',
        content: { type: 'exit' },
      },
    ],
  },
  {
    id: 3,
    name: "The Troll's Hoard",
    description: 'Gold and glory — but the troll guards them both.',
    startHp: 20,
    startGold: 8,
    rooms: [
      {
        id: 0,
        name: 'Entrance',
        content: { type: 'start' },
      },
      {
        id: 1,
        name: 'Dark Tunnel',
        content: {
          type: 'enemy',
          enemy: { id: 'rat', name: 'Giant Rat', hp: 6, attack: 3, defense: 0, goldReward: 2,
            attrs: { sneakThreshold: 6, intimidateThreshold: 0 } },
        },
      },
      {
        id: 2,
        name: "Trader's Corner",
        content: {
          type: 'shop',
          items: [
            { item: ITEMS.mace, cost: 6 },
            { item: ITEMS.sword, cost: 8 },
            { item: ITEMS.shield, cost: 6 },
          ],
        },
      },
      {
        id: 3,
        name: 'Goblin Camp',
        content: {
          type: 'enemy',
          enemy: {
            id: 'goblin',
            name: 'Goblin',
            hp: 14,
            attack: 6,
            defense: 1,
            goldReward: 4,
            loot: ITEMS.key,
            attrs: { sneakThreshold: 4, intimidateThreshold: 3 },
          },
        },
      },
      {
        id: 4,
        name: 'Armoury',
        content: { type: 'chest', locked: true, lootItem: ITEMS.leather_armor, lootGold: 0 },
      },
      {
        id: 5,
        name: 'Skeleton Guard',
        content: {
          type: 'enemy',
          enemy: { id: 'skeleton', name: 'Skeleton Warrior', hp: 18, attack: 8, defense: 2, goldReward: 6,
            attrs: { sneakThreshold: 0, intimidateThreshold: 8 } },
        },
      },
      {
        id: 6,
        name: "Troll's Lair",
        content: {
          type: 'enemy',
          enemy: { id: 'troll', name: 'Cave Troll', hp: 26, attack: 10, defense: 3, goldReward: 15,
            attrs: { sneakThreshold: 0, intimidateThreshold: 15 } },
        },
      },
      {
        id: 7,
        name: 'Exit',
        content: { type: 'exit' },
      },
    ],
  },
];
