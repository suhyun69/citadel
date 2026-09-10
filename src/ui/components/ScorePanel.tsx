'use client';

import type { GameState } from '@/engine/types/state';

export function ScorePanel({ state }: { state: GameState }) {
  const result = state.result;
  if (!result) return null;

  const rows = [...result.scores].sort((a, b) => b.total - a.total);

  return (
    <div className="panel">
      <h2>최종 점수</h2>
      <table className="scores">
        <thead>
          <tr>
            <th>플레이어</th>
            <th>건물</th>
            <th>5종</th>
            <th>완성</th>
            <th>특수</th>
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.player} className={s.player === result.winner ? 'win' : ''}>
              <td>
                P{s.player}
                {s.player === result.winner ? ' 승' : ''}
              </td>
              <td>{s.buildingCost}</td>
              <td>{s.allKindsBonus}</td>
              <td>{s.completionBonus}</td>
              <td>{s.uniqueBonus}</td>
              <td className="total">{s.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
