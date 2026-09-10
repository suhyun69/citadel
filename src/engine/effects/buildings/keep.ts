import type { GameHooks } from '../hooks';
import { isCard } from './_shared';

/**
 * 외성 — 8번 캐릭터 능력의 목표가 되지 않는다.
 *
 * 주교와 달리 **외성 카드 한 장만** 지킨다(howto.md 건물 상세 설명:
 * "외성의 효과는 외성 카드에만 적용됩니다").
 */
export const keep: GameHooks = {
  immuneToRank8: (entry) => isCard(entry, 'keep'),
};
