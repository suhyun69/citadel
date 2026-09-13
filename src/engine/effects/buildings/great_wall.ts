import type { GameHooks } from '../hooks';
import { isCard } from './_shared';

export const GREAT_WALL_SURCHARGE = 1;

/**
 * 장성 — 8번 캐릭터가 이 도시의 건물에 손대려면 금화 1닢을 더 내야 한다.
 *
 * 장성 자신은 예외다. 외성이 자기만 지키는 것과 반대로, 장성은 **자기를 뺀
 * 나머지**를 지킨다.
 */
export const great_wall: GameHooks = {
  rank8Surcharge: (entry) => (isCard(entry, 'great_wall') ? 0 : GREAT_WALL_SURCHARGE),
};
