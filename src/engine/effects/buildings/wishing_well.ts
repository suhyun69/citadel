import { scoringKindOf } from '../../flow/scoring';
import type { GameHooks } from '../hooks';

/**
 * 소원의 우물 — 자기 도시의 특수 건물 1채당 1점 (소원의 우물 자신 포함).
 *
 * "특수 건물인가" 를 원래 종류가 아니라 **점수 계산상의 종류**로 판정하는 것이
 * 핵심이다. 유령 지구를 다른 종류로 쓰기로 했다면 그것은 더 이상 특수 건물이
 * 아니므로 여기서 빠진다(howto.md 건물 상세 설명).
 */
export const wishing_well: GameHooks = {
  endGameScore(ctx) {
    const city = ctx.state.players[ctx.self]?.city ?? [];
    return city.filter(
      (entry) => scoringKindOf(ctx.state, ctx.self, entry, ctx.wildcardAs) === 'unique',
    ).length;
  },
};
