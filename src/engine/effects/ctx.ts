import type { Prompt } from '../state/prompt';
import type { GameEvent } from '../state/event';
import type { PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';
import type { BuildingKind } from '@/data/types';
import type { EffectCtx, ScoreCtx } from './hooks';

export function makeCtx(state: GameState, self: PlayerId): EffectCtx {
  return {
    state,
    self,
    turn: state.action?.turn ?? null,
    push: (e: GameEvent) => {
      state.log.push(e);
    },
    ask: (d: Prompt) => {
      if (state.pending) throw new Error('이미 대기 중인 결정이 있습니다');
      state.pending = d;
    },
  };
}

export const makeScoreCtx = (
  state: GameState,
  self: PlayerId,
  wildcardAs: BuildingKind | null = null,
): ScoreCtx => ({ state, self, wildcardAs });
