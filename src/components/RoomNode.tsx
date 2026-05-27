import { RoomDefinition, RoomState, KnowledgeEntry } from '../game/types';

interface Props {
  room: RoomDefinition;
  roomState: RoomState;
  knowledge: KnowledgeEntry | undefined;
  isPlayerHere: boolean;
  onClick: () => void;
}

const ROOM_ICONS: Record<string, string> = {
  start: '⚑',
  enemy: '☠',
  shop: '⚙',
  chest: '▣',
  exit: '◈',
};

const ROOM_COLORS: Record<string, string> = {
  start:  'border-stone-500 text-stone-400',
  enemy:  'border-red-700 text-red-400',
  shop:   'border-green-700 text-green-400',
  chest:  'border-yellow-600 text-yellow-400',
  exit:   'border-blue-600 text-blue-400',
};

const UNKNOWN_STYLE = 'border-stone-700 text-stone-600';

function getSubLabel(knowledge: KnowledgeEntry, roomState: RoomState): string {
  switch (knowledge.type) {
    case 'enemy':
      if (roomState.enemyDefeated) return '✓ slain';
      return `${roomState.enemyHp > 0 && roomState.enemyHp < knowledge.hp
        ? `${roomState.enemyHp}/${knowledge.hp}`
        : knowledge.hp} HP`;
    case 'shop':
      return `${knowledge.items.length} items`;
    case 'chest':
      if (roomState.opened) return '✓ opened';
      return knowledge.locked ? '🔒 locked' : knowledge.lootDescription;
    case 'exit':
      return 'escape!';
    case 'start':
      return 'start';
    default:
      return '';
  }
}

export function RoomNode({ room, roomState, knowledge, isPlayerHere, onClick }: Props) {
  const known = !!knowledge;
  const colorClass = known ? ROOM_COLORS[knowledge.type] : UNKNOWN_STYLE;
  const icon = known ? ROOM_ICONS[knowledge.type] : '?';
  const label = known ? room.name : '???';
  const sub = knowledge ? getSubLabel(knowledge, roomState) : '';

  const defeated = roomState.enemyDefeated;
  const opened = roomState.opened;
  const dimmed = defeated || opened;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center
        w-24 h-20 border-2 rounded px-1 py-1 shrink-0
        transition-all duration-150 cursor-pointer select-none
        ${colorClass}
        ${isPlayerHere ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-stone-950 bg-stone-800' : 'bg-stone-900 hover:bg-stone-800'}
        ${dimmed && !isPlayerHere ? 'opacity-50' : ''}
      `}
    >
      {isPlayerHere && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-amber-400 text-xs font-bold">YOU</span>
      )}
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] font-bold text-center leading-tight mt-1 truncate w-full text-center">{label}</span>
      {sub && (
        <span className="text-[9px] text-stone-500 leading-tight text-center">{sub}</span>
      )}
    </button>
  );
}
