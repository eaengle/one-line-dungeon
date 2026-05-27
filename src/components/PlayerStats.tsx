import { PlayerStats as Stats } from '../game/types';

interface Props {
  player: Stats;
  onUsePotion: () => void;
}

export function PlayerStats({ player, onUsePotion }: Props) {
  const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
  const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500';
  const consumables = player.inventory.filter(i => i.type === 'consumable');
  const effectiveStealth = player.stealth + Number(player.traits['stealth_bonus'] ?? 0);

  function consumableLabel() {
    if (consumables.length === 0) return null;
    const hasPotion = consumables.some(i => i.hpRestore > 0);
    const hasScroll = consumables.some(i => i.stealthBonus > 0);
    if (hasPotion && !hasScroll) return `Use Potion (${consumables.length})`;
    if (hasScroll && !hasPotion) return `Use Scroll (${consumables.length})`;
    return `Use Item (${consumables.length})`;
  }

  const label = consumableLabel();

  return (
    <div className="border-t border-stone-800 px-4 py-3 flex flex-wrap gap-6 items-center">
      <div className="flex flex-col gap-1 min-w-40">
        <div className="flex justify-between text-xs text-stone-400 mb-1">
          <span>HP</span>
          <span className={player.hp <= 5 ? 'text-red-400 font-bold' : 'text-stone-300'}>
            {player.hp} / {player.maxHp}
          </span>
        </div>
        <div className="w-full h-3 bg-stone-800 rounded overflow-hidden">
          <div
            className={`h-full rounded transition-all duration-300 ${hpColor}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <Stat label="Gold" value={`${player.gold}g`} color="text-yellow-400" />
        <Stat label="Atk" value={`${player.attack}`} color="text-red-400" />
        <Stat label="Def" value={`${player.defense}`} color="text-blue-400" />
        <Stat label="Dex" value={`${player.dexterity}`} color="text-violet-400" />
        <Stat label="Stealth" value={`${effectiveStealth}`} color="text-emerald-400" />
        {player.keys > 0 && <Stat label="Keys" value={`${player.keys}`} color="text-amber-400" />}
      </div>

      <div className="flex gap-3 text-xs text-stone-400">
        <span>Weapon: <span className="text-stone-200">{player.weapon?.name ?? '—'}</span></span>
        <span>Armor: <span className="text-stone-200">{player.armor?.name ?? '—'}</span></span>
      </div>

      {label && (
        <button
          onClick={onUsePotion}
          className="ml-auto text-xs px-3 py-1 rounded border border-green-700 text-green-400 hover:bg-green-900 transition-colors"
        >
          {label}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-stone-500 text-[10px] uppercase">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
