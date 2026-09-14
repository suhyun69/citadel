import type { GameHooks } from '../hooks';
import { abilityOption, markUsed, matches } from './_shared';

export const TAX_COLLECT = 'tax_collector.collect';

/**
 * 세리 — 세리 토큰 위에 쌓인 재산세를 통째로 가져온다.
 *
 * 재산세를 **걷는 쪽**은 여기가 아니다. 세리가 조합에 들어 있기만 하면
 * 이번 라운드에 아무도 세리를 고르지 않았더라도 모두가 세금을 내므로
 * (howto.md:442), 징수는 placeBuilding 이 부르는 rules/tax.ts 가 맡는다.
 * 이 카드가 하는 일은 쌓인 것을 가져가는 것뿐이다.
 */
export const tax_collector: GameHooks = {
  turnActions: (ctx) => ((ctx.state.taxPot ?? 0) > 0 ? abilityOption(ctx, TAX_COLLECT) : []),

  performAction(action, ctx) {
    if (!matches(action, TAX_COLLECT)) return false;
    markUsed(ctx, TAX_COLLECT);

    const pot = ctx.state.taxPot ?? 0;
    const p = ctx.state.players[ctx.self];
    if (!p || pot <= 0) return true;

    p.gold += pot;
    ctx.state.taxPot = 0;
    ctx.push({ t: 'gained', player: ctx.self, gold: pot, reason: '세리 징수' });
    return true;
  },
};
