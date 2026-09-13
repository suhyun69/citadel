import { BUILDING_KINDS } from '@/data/types';
import { scoringKindOf } from '../../flow/scoring';
import type { GameHooks } from '../hooks';

export const CAPITOL_BONUS = 3;
export const CAPITOL_THRESHOLD = 3;

/**
 * 의사당 — 같은 종류의 건물이 3채 이상이면 3점.
 *
 * 종류가 여럿 조건을 채워도 **추가 점수는 한 번만** 받는다
 * (howto.md 건물 상세 설명). 그래서 개수만큼 곱하지 않는다.
 */
export const capitol: GameHooks = {
  endGameScore(ctx) {
    const city = ctx.state.players[ctx.self]?.city ?? [];
    const counts = new Map<string, number>();

    for (const entry of city) {
      const kind = scoringKindOf(ctx.state, ctx.self, entry, ctx.wildcardAs);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }

    return BUILDING_KINDS.some((k) => (counts.get(k) ?? 0) >= CAPITOL_THRESHOLD) ? CAPITOL_BONUS : 0;
  },
};
