import type { GameHooks } from '../hooks';

/**
 * 공동묘지 — 자기 도시의 건물 1채를 부수면 건설비용 없이 지을 수 있다.
 *
 * 도적 소굴처럼 **건설하는 순간** 필요한 효과라, 그때 공동묘지는 아직 손에
 * 있다. 건설 경로가 카드 정의에서 직접 이 훅을 꺼낸다.
 *
 * 이쪽은 지불 방식을 바꾸는 것이지 추가 건설이 아니므로, 건설 횟수에는
 * 평소대로 포함된다.
 */
export const graveyard: GameHooks = {
  canSacrificeToBuild: (def) => def.id === 'graveyard',
};
