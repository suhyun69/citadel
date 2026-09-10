'use client';

import { characterDef } from '@/data/types';
import type { GameState } from '@/engine/types/state';
import { cardTitle, costOf, kindOf } from '../format';

/**
 * 봇끼리의 관전 화면이라 전지적 시점으로 보여준다 — 손패 수까지만 노출하고
 * 내용은 감추는데, 이는 프라이버시가 아니라 화면이 시끄러워지지 않게 하기
 * 위해서다. 봇은 어차피 PlayerView 만 받는다.
 */
export function PlayerBoards({ state }: { state: GameState }) {
  const turnPlayer = state.action?.turn?.playerId ?? null;
  const target = state.config.targetCitySize;

  return (
    <div className="panel">
      <h2>플레이어</h2>
      <div className="boards">
        {state.players.map((p) => {
          const slot = p.character;
          const role = slot?.revealed ? characterDef(slot.characterId).name : '비공개';
          const done = Math.min(p.city.length, target);

          return (
            <div key={p.id} className={['board', turnPlayer === p.id ? 'turn' : ''].join(' ')}>
              <div className="head">
                <span className="name">
                  P{p.id}
                  {state.crowned === p.id ? ' 👑' : ''}
                </span>
                <span className="role">
                  {role}
                  {slot?.killed ? ' (암살)' : ''}
                </span>
                <span className="stats">
                  금화 <b>{p.gold}</b> · 손패 {p.hand.length} · 도시 {p.city.length}/{target}
                </span>
              </div>

              <div className="city">
                {p.city.map((e) => (
                  <span key={e.card} className={`tile ${kindOf(e.card)}`}>
                    {cardTitle(e.card)}
                    <span className="c">{costOf(e.card)}</span>
                  </span>
                ))}
              </div>

              <div className="progress">
                <span style={{ width: `${(done / target) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
