import { destroyTargets } from '../../rules/rank8';
import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, markUsed, matches } from './_shared';

export const WARLORD_INCOME = 'warlord.income';
export const WARLORD_DESTROY = 'warlord.destroy';

/**
 * 장군 — 건물을 파괴하고, 군사 건물 수만큼 금화를 받는다.
 *
 * 수입과 파괴는 별개 능력이다. 수입을 먼저 받아 파괴비용을 마련할 수도,
 * 파괴로 상대를 눌러둔 뒤 수입을 받을 수도 있다.
 */
export const warlord: GameHooks = {
  turnActions: (ctx) => [
    ...abilityOption(ctx, WARLORD_INCOME),
    ...(destroyTargets(ctx.state, ctx.self).length > 0 ? abilityOption(ctx, WARLORD_DESTROY) : []),
  ],

  performAction(action, ctx) {
    if (matches(action, WARLORD_INCOME)) {
      grantKindIncome(ctx, 'military', WARLORD_INCOME);
      return true;
    }
    if (matches(action, WARLORD_DESTROY)) {
      markUsed(ctx, WARLORD_DESTROY);
      const options = destroyTargets(ctx.state, ctx.self);
      if (options.length === 0) return true;

      ctx.ask({
        type: 'warlordTarget',
        player: ctx.self,
        prompt: '파괴할 건물을 고르세요 (건너뛸 수 있습니다)',
        options,
        canSkip: true,
      });
      return true;
    }
    return false;
  },
};
