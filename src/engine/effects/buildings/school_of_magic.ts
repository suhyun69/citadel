import type { GameHooks } from '../hooks';
import { isCard } from './_shared';

/**
 * 마법학교 — 종류별 수입을 받을 때 원하는 종류의 건물로 간주한다.
 *
 * ★ 유령 지구와 정반대다. 원문이 "자신의 도시 건물 종류에 따라 자원을 받는
 *   능력을 사용할 때" 이므로 **수입 계산에만** 걸린다. 게임 종료 점수
 *   (5종 보너스·소원의 우물)에는 관여하지 않으므로 scoringKindOverride 가
 *   아니라 countsAsKind 로 구현한다.
 */
export const school_of_magic: GameHooks = {
  countsAsKind: (entry) => isCard(entry, 'school_of_magic'),
};
