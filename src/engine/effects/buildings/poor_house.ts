import type { GameHooks } from '../hooks';

/** 구빈원 — 차례를 끝냈을 때 금고가 비어 있으면 금화 1닢. */
export const poor_house: GameHooks = {
  onTurnEnd(ctx) {
    const p = ctx.state.players[ctx.self];
    if (!p || p.gold > 0) return;
    p.gold += 1;
    ctx.push({ t: 'gained', player: ctx.self, gold: 1, reason: '구빈원' });
  },
};
