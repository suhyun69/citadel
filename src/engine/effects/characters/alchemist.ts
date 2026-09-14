import type { GameHooks } from '../hooks';

/**
 * 연금술사 — 차례가 끝날 때 이번 차례에 낸 **건설비용**을 전부 돌려받는다.
 *
 * 종류별 수입 능력이 따로 없는 대신, 금화만 충분하면 건설이 사실상 공짜다.
 * 돌려받는 것은 건설비용뿐이라, 대장간이나 세리에게 낸 금화는 빠진다
 * (howto.md:362) — 그래서 placeBuilding 이 `buildGoldPaid` 만 따로 센다.
 *
 * onTurnEnd 가 아니라 onTurnEndLate 인 것이 중요하다. 구빈원은 "금고가 비었나"
 * 를 환급 **전에** 판정해야 한다(howto.md:461).
 */
export const alchemist: GameHooks = {
  onTurnEndLate(ctx) {
    const refund = ctx.turn?.buildGoldPaid ?? 0;
    if (refund <= 0) return;

    const p = ctx.state.players[ctx.self];
    if (!p) return;
    p.gold += refund;
    ctx.push({ t: 'gained', player: ctx.self, gold: refund, reason: '연금술사 환급' });
  },
};
