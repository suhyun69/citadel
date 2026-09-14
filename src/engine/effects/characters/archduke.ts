import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, matches } from './_shared';

export const ARCHDUKE_INCOME = 'archduke.income';

/**
 * 대공 — 왕관을 가져오고 귀족 건물 수만큼 **카드**를 받는다.
 *
 * 왕과 같은 자리를 다투지만 받는 자원이 다르다. 왕관 획득은 "반드시" 이므로
 * 선택지로 내지 않고 차례 시작에 자동 처리하고, 암살당하면 라운드 종료 시
 * 작위 계승자로서 왕관만 가져간다(howto.md:322).
 */
export const archduke: GameHooks = {
  incomeKind: 'noble',

  onTurnStart(ctx) {
    // 마녀가 빼앗은 차례라면 왕관은 움직이지 않는다. 마법에 걸려도 왕관은
    // (마녀가 아니라) 대공 자신이 가져간다 — 그쪽은 본인 차례에 이미 챙겼다
    // (howto.md:232).
    if (ctx.turn?.stolen) return;
    if (ctx.state.crowned === ctx.self) return;
    ctx.state.crowned = ctx.self;
    ctx.push({ t: 'crownMoved', to: ctx.self, reason: '대공' });
  },

  onRoundEnd(ctx) {
    const slot = ctx.state.players[ctx.self]?.character;
    if (!slot?.killed) return;
    if (ctx.state.crowned === ctx.self) return;
    ctx.state.crowned = ctx.self;
    ctx.push({ t: 'crownMoved', to: ctx.self, reason: '암살당한 대공의 작위 계승' });
  },

  turnActions: (ctx) => abilityOption(ctx, ARCHDUKE_INCOME),

  performAction(action, ctx) {
    if (!matches(action, ARCHDUKE_INCOME)) return false;
    grantKindIncome(ctx, 'noble', ARCHDUKE_INCOME, 'card');
    return true;
  },
};
