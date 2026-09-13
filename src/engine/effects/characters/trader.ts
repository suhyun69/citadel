import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, matches } from './_shared';

export const TRADER_INCOME = 'trader.income';

/**
 * 교역상 — 상업 건물은 몇 채든 짓고, 상업 건물 수만큼 금화를 받는다.
 *
 * 상업 건물을 짓는 것이 건설 횟수에 포함되지 않으므로(howto.md:370),
 * 평범한 1채 건설에 더해 상업 건물을 계속 올릴 수 있다.
 */
export const trader: GameHooks = {
  incomeKind: 'trade',

  isBuildFree: (def) => def.kind === 'trade',

  turnActions: (ctx) => abilityOption(ctx, TRADER_INCOME),

  performAction(action, ctx) {
    if (!matches(action, TRADER_INCOME)) return false;
    grantKindIncome(ctx, 'trade', TRADER_INCOME, 'gold');
    return true;
  },
};
