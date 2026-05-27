import { useEffect, useRef } from 'react';
import { LogEntry } from '../game/types';

interface Props {
  entries: LogEntry[];
}

const LOG_COLORS: Record<LogEntry['type'], string> = {
  info:   'text-stone-400',
  combat: 'text-red-400',
  loot:   'text-yellow-400',
  death:  'text-red-500 font-bold',
  shop:   'text-green-400',
  system: 'text-amber-400',
};

export function GameLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const recent = entries.slice(-20);

  return (
    <div className="border-t border-stone-800 h-28 overflow-y-auto px-4 py-2 font-mono">
      {recent.map(entry => (
        <div key={entry.id} className={`text-xs leading-5 ${LOG_COLORS[entry.type]}`}>
          <span className="text-stone-600 mr-2">›</span>
          {entry.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
