import { captureTargets } from '../../rules/rank8';
import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, markUsed, matches } from './_shared';

export const MARSHAL_INCOME = 'marshal.income';
export const MARSHAL_CAPTURE = 'marshal.capture';

/**
 * 육군대장 — 값싼 건물을 돈 주고 빼앗아 오고, 군사 건물 수만큼 금화를 받는다.
 *
 * 장군이 부수는 자리에서 이쪽은 **가져온다**. 그래서 제약이 하나 더 붙는다 —
 * 이미 같은 이름을 가진 건물은 가져올 수 없다.
 */
export const marshal: GameHooks = {
  incomeKind: 'military',

  turnActions: (ctx) => [
    ...abilityOption(ctx, MARSHAL_INCOME),
    ...(captureTargets(ctx.state, ctx.self).length > 0 ? abilityOption(ctx, MARSHAL_CAPTURE) : []),
  ],

  performAction(action, ctx) {
    if (matches(action, MARSHAL_INCOME)) {
      grantKindIncome(ctx, 'military', MARSHAL_INCOME, 'gold');
      return true;
    }
    if (matches(action, MARSHAL_CAPTURE)) {
      markUsed(ctx, MARSHAL_CAPTURE);
      const options = captureTargets(ctx.state, ctx.self);
      if (options.length === 0) return true;

      ctx.ask({
        type: 'rank8Target',
        player: ctx.self,
        text: '점령할 건물을 고르세요 (건너뛸 수 있습니다)',
        purpose: 'capture',
        options,
        canSkip: true,
      });
      return true;
    }
    return false;
  },
};
