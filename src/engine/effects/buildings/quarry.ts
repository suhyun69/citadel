import type { GameHooks } from '../hooks';

/**
 * 채석장 — 이미 도시에 있는 건물과 이름이 같은 건물도 건설할 수 있다.
 *
 * 후순위 참고: 규칙은 이 효과가 치안판사·외교관·육군대장으로 **얻은** 건물에는
 * 적용되지 않는다고 한다. 그 캐릭터들이 들어올 때 취득 경로를 훅에 넘겨야 한다.
 */
export const quarry: GameHooks = {
  allowsDuplicateTitle: () => true,
};
