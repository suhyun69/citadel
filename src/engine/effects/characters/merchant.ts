import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, markUsed, matches } from './_shared';

export const MERCHANT_BONUS = 'merchant.bonus';
export const MERCHANT_INCOME = 'merchant.income';

/**
 * 상인 — 금화 1닢을 더 받고, 상업 건물 수만큼 금화를 받는다.
 *
 * 둘을 별개 능력으로 나눈 이유: 보너스 1닢을 먼저 받아 건물을 지은 뒤
 * 상업 수입을 받으면 방금 지은 상업 건물까지 세어진다. 합쳐두면 그 선택이 사라진다.
 */
export const merchant: GameHooks = {
  turnActions: (ctx) => [
    ...abilityOption(ctx, MERCHANT_BONUS),
    ...abilityOption(ctx, MERCHANT_INCOME),
  ],

  performAction(action, ctx) {
    if (matches(action, MERCHANT_BONUS)) {
      markUsed(ctx, MERCHANT_BONUS);
      const p = ctx.state.players[ctx.self];
      if (p) {
        p.gold += 1;
        ctx.push({ t: 'gained', player: ctx.self, gold: 1, reason: '상인 보너스' });
      }
      return true;
    }
    if (matches(action, MERCHANT_INCOME)) {
      grantKindIncome(ctx, 'trade', MERCHANT_INCOME);
      return true;
    }
    return false;
  },
};
