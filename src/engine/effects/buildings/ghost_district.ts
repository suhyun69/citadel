import type { GameHooks } from '../hooks';
import { isCard } from './_shared';

/**
 * 유령 지구 — 게임이 종료되면 원하는 종류의 건물로 간주한다.
 *
 * ★ 마법학교와 정반대다. 유령 지구는 원문이 "게임이 종료되면" 이라 **점수
 *   계산에만** 걸리고 수입에는 관여하지 않는다. 그래서 countsAsKind 가 아니라
 *   scoringKindOverride 로 구현한다.
 *
 * 어떤 종류로 쓸지는 5종 보너스와 소원의 우물 사이의 트레이드오프라
 * scoring.ts 가 후보를 전부 계산해 최종 점수가 가장 높은 쪽을 고른다.
 */
export const ghost_district: GameHooks = {
  scoringKindOverride: (entry) => (isCard(entry, 'ghost_district') ? 'wildcard' : null),
};
