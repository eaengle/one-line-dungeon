import { GameState } from '../game/types';
import { ACTION_REGISTRY, ActionContext } from '../game/actions';

interface Props {
  state: GameState;
  onFight: () => void;
  onAttemptAction: (actionId: string) => void;
  onBuyItem: (itemId: string) => void;
  onOpenChest: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}

export function RoomPanel({ state, onFight, onAttemptAction, onBuyItem, onOpenChest, onMoveLeft, onMoveRight }: Props) {
  const { playerPos, levelDef, roomStates } = state;
  const room = levelDef.rooms[playerPos];
  const roomState = roomStates[playerPos];
  const isFirst = playerPos === 0;
  const isLast = playerPos === levelDef.rooms.length - 1;

  // Disable forward nav when a living enemy is blocking the path
  const blockedForward = room.content.type === 'enemy' && !roomState.enemyDefeated;

  return (
    <div className="border-t border-stone-800 px-4 py-4 min-h-36">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-3">
            {room.name}
          </h2>
          <RoomActions
            state={state}
            onFight={onFight}
            onAttemptAction={onAttemptAction}
            onBuyItem={onBuyItem}
            onOpenChest={onOpenChest}
          />
        </div>

        <div className="flex gap-2 mt-1 shrink-0">
          <NavButton onClick={onMoveLeft} disabled={isFirst} label="← Back" />
          <NavButton
            onClick={onMoveRight}
            disabled={isLast || blockedForward}
            label={blockedForward ? 'Blocked →' : 'Forward →'}
          />
        </div>
      </div>
    </div>
  );
}

function RoomActions({
  state,
  onFight,
  onAttemptAction,
  onBuyItem,
  onOpenChest,
}: {
  state: GameState;
  onFight: () => void;
  onAttemptAction: (id: string) => void;
  onBuyItem: (id: string) => void;
  onOpenChest: () => void;
}) {
  const { playerPos, levelDef, roomStates, player } = state;
  const room = levelDef.rooms[playerPos];
  const roomState = roomStates[playerPos];

  if (room.content.type === 'start') {
    return <p className="text-stone-500 text-xs">Move forward to begin.</p>;
  }

  if (room.content.type === 'exit') {
    return <p className="text-green-400 text-xs font-bold">You found the exit!</p>;
  }

  if (room.content.type === 'enemy') {
    const enemy = room.content.enemy;
    if (roomState.enemyDefeated) {
      return <p className="text-stone-500 text-xs">The {enemy.name} lies defeated.</p>;
    }

    const lockedToFight = !!roomState.flags['locked_to_fight'];

    // Build action context to evaluate canAttempt for registry actions
    const ctx: ActionContext = {
      player,
      enemy,
      currentEnemyHp: roomState.enemyHp,
      roomState,
      roomIndex: playerPos,
      levelDef,
    };
    const registryActions = Object.values(ACTION_REGISTRY).filter(a => a.canAttempt(ctx));

    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs text-stone-400">
          <span className="text-red-300 font-bold">{enemy.name}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onFight}
            className="text-xs px-4 py-1.5 rounded border font-bold transition-colors border-red-700 text-red-400 hover:bg-red-950 cursor-pointer"
          >
            Fight
          </button>
          {!lockedToFight && registryActions.map(a => (
            <button
              key={a.id}
              onClick={() => onAttemptAction(a.id)}
              className="text-xs px-4 py-1.5 rounded border font-bold border-stone-600 text-stone-300 hover:bg-stone-800 cursor-pointer transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (room.content.type === 'shop') {
    return (
      <div className="flex flex-wrap gap-2">
        {room.content.items.map(si => {
          const purchased = roomState.purchasedItemIds.includes(si.item.id);
          const canAfford = player.gold >= si.cost;
          return (
            <button
              key={si.item.id}
              onClick={() => onBuyItem(si.item.id)}
              disabled={purchased || !canAfford}
              className={`
                text-xs px-3 py-2 rounded border flex flex-col items-start transition-colors
                ${purchased
                  ? 'border-stone-700 text-stone-600 cursor-not-allowed'
                  : canAfford
                    ? 'border-green-700 text-green-400 hover:bg-green-950 cursor-pointer'
                    : 'border-stone-700 text-stone-600 cursor-not-allowed'}
              `}
            >
              <span className="font-bold">{si.item.name}</span>
              <span className="text-[10px] text-stone-500">{si.item.description}</span>
              <span className={canAfford && !purchased ? 'text-yellow-400' : 'text-stone-600'}>
                {purchased ? 'Sold' : `${si.cost}g`}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (room.content.type === 'chest') {
    if (roomState.opened) {
      return <p className="text-stone-500 text-xs">The chest has been opened.</p>;
    }
    const needsKey = room.content.locked && player.keys < 1;
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-stone-500">
          {room.content.locked
            ? needsKey ? 'A locked chest. You need a key.' : 'A locked chest. You have a key.'
            : 'A chest sits here. It may be trapped.'}
        </p>
        <button
          onClick={onOpenChest}
          disabled={needsKey}
          className={`
            text-xs px-4 py-1.5 rounded border font-bold w-fit transition-colors
            ${needsKey
              ? 'border-stone-700 text-stone-600 cursor-not-allowed'
              : 'border-yellow-600 text-yellow-400 hover:bg-yellow-950 cursor-pointer'}
          `}
        >
          {room.content.locked ? 'Unlock Chest' : 'Open Chest'}
        </button>
      </div>
    );
  }

  return null;
}

function NavButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        text-xs px-3 py-1.5 rounded border transition-colors
        ${disabled
          ? 'border-stone-800 text-stone-700 cursor-not-allowed'
          : 'border-stone-600 text-stone-300 hover:bg-stone-800 cursor-pointer'}
      `}
    >
      {label}
    </button>
  );
}
