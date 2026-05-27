import { GameState } from '../game/types';
import { RoomNode } from './RoomNode';

interface Props {
  state: GameState;
  onRoomClick: (index: number) => void;
}

export function DungeonLine({ state, onRoomClick }: Props) {
  return (
    <div className="w-full overflow-x-auto py-8 px-4">
      <div className="flex items-center gap-0 min-w-max mx-auto w-fit">
        {state.levelDef.rooms.map((room, i) => (
          <div key={room.id} className="flex items-center">
            <RoomNode
              room={room}
              roomState={state.roomStates[i]}
              knowledge={state.knowledgeMap[i]}
              isPlayerHere={state.playerPos === i}
              onClick={() => onRoomClick(i)}
            />
            {i < state.levelDef.rooms.length - 1 && (
              <div className="flex items-center shrink-0 w-8">
                <div className="h-px w-full bg-stone-600" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
