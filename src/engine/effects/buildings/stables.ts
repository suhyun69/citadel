import type { GameHooks } from '../hooks';

/**
 * 마구간 — 마구간을 짓는 것은 건설 횟수에 포함되지 않는다.
 *
 * 건설하는 순간 필요한 효과라 그때 마구간은 아직 손에 있다. 도시 기준
 * collectHooks 로는 잡히지 않으므로, 건설 경로가 카드 정의에서 직접 꺼낸다
 * (도적 소굴과 같은 방식).
 */
export const stables: GameHooks = {
  isBuildFree: (def) => def.id === 'stables',
};
