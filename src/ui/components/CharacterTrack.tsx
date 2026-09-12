'use client';

import { characterDef } from '@/data/types';
import type { GameState } from '@/engine/state/game-state';

/** 순번 1~8 트랙. 누가 무엇을 들고 있는지는 공개된 것만 보여준다. */
export function CharacterTrack({ state }: { state: GameState }) {
  const called = state.action?.rankCursor ?? null;
  const faceUp = new Set(state.selection?.faceUp ?? []);

  return (
    <div className="panel">
      <h2>순번</h2>
      <div className="track">
        {state.config.characterIds.map((id) => {
          const def = characterDef(id);
          const holder = state.players.find(
            (p) => p.character?.characterId === id && p.character.revealed,
          );
          const discarded = faceUp.has(id);
          const killed = holder?.character?.killed ?? false;

          return (
            <div
              key={id}
              className={['rank', called === def.rank ? 'active' : '', discarded ? 'gone' : ''].join(' ')}
            >
              <span className="no">{def.rank}번</span>
              <span className="nm">{def.name}</span>
              <span className="who">
                {discarded ? '버림' : holder ? `P${holder.id}${killed ? ' ✕' : ''}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
