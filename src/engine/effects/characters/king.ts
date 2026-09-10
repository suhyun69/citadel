import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, matches } from './_shared';

export const KING_INCOME = 'king.income';

/**
 * 왕 — 왕관을 가져오고 귀족 건물 수만큼 금화를 받는다.
 *
 * 왕관 획득은 "반드시" 이므로 선택지로 내지 않고 차례 시작에 자동 처리한다.
 * 암살당하면 차례 자체가 없으므로, 라운드 종료 시 왕위 계승자로서
 * 왕관만 가져간다(howto.md:298).
 */
export const king: GameHooks = {
  onTurnStart(ctx) {
    if (ctx.state.crowned === ctx.self) return;
    ctx.state.crowned = ctx.self;
    ctx.push({ t: 'crownMoved', to: ctx.self, reason: '왕' });
  },

  onRoundEnd(ctx) {
    const slot = ctx.state.players[ctx.self]?.character;
    if (!slot?.killed) return;
    if (ctx.state.crowned === ctx.self) return;
    ctx.state.crowned = ctx.self;
    ctx.push({ t: 'crownMoved', to: ctx.self, reason: '암살당한 왕의 왕위 계승' });
  },

  turnActions: (ctx) => abilityOption(ctx, KING_INCOME),

  performAction(action, ctx) {
    if (!matches(action, KING_INCOME)) return false;
    grantKindIncome(ctx, 'noble', KING_INCOME);
    return true;
  },
};
