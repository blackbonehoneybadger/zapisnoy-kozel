import type { GameState, RoundResult } from '../engine/types';

interface Props {
  state: GameState;
  results?: RoundResult[] | null;
}

/** Таблица счёта: либо текущий счёт, либо итоги раунда. */
export function ScoreBoard({ state, results }: Props) {
  const rows = results
    ? results.map((r) => ({
        id: r.playerId,
        name: r.name,
        score: r.total,
        gained: r.gained,
        busted: r.busted,
        reset: r.reset,
      }))
    : state.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        gained: null as number | null,
        busted: p.busted,
        reset: false,
      }));

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg gold-text">Счёт</h3>
        <span className="text-[11px] text-white/50">Лимит {state.settings.scoreLimit}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`flex items-center justify-between rounded-xl px-3 py-2 ${
              r.busted ? 'bg-wine-700/20' : 'bg-white/[0.03]'
            }`}
          >
            <span className={`text-sm ${r.busted ? 'text-wine-400 line-through' : 'text-white/85'}`}>
              {r.name}
            </span>
            <span className="flex items-center gap-2">
              {r.gained !== null && r.gained > 0 && (
                <span className="text-[11px] text-wine-400">+{r.gained}</span>
              )}
              {r.reset && <span className="text-[11px] text-emerald-300">обнулён</span>}
              {r.busted && <span className="text-[11px] text-wine-400">улетел</span>}
              <span className="font-display text-lg text-gold-300">{r.score}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
