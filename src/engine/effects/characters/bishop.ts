import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, isKilled, matches } from './_shared';

export const BISHOP_INCOME = 'bishop.income';

/**
 * 주교 — 8번 캐릭터가 자기 도시에 손대지 못하게 막고, 종교 건물 수만큼 금화를 받는다.
 *
 * 암살당하면 방어가 사라진다(howto.md:335). 면역은 카드 한 장이 아니라
 * **도시 전체**에 걸린다는 점이 외성과 다르다.
 */
export const bishop: GameHooks = {
  immuneToRank8: (_entry, ctx) => !isKilled(ctx),

  turnActions: (ctx) => abilityOption(ctx, BISHOP_INCOME),

  performAction(action, ctx) {
    if (!matches(action, BISHOP_INCOME)) return false;
    grantKindIncome(ctx, 'religious', BISHOP_INCOME);
    return true;
  },
};
