import { draw } from '../../rules/deck';
import type { GameHooks } from '../hooks';
import { isUse, markUsed, onceOption } from './_shared';

export const SMITHY_COST = 2;
export const SMITHY_CARDS = 3;

/** 대장간 — 차례마다 한 번, 금화 2닢을 내고 카드 3장을 받는다. */
export const smithy: GameHooks = {
  turnActions: (ctx) =>
    onceOption(ctx, 'smithy', (ctx.state.players[ctx.self]?.gold ?? 0) >= SMITHY_COST),

  performAction(action, ctx) {
    if (!isUse(action, 'smithy')) return false;
    const p = ctx.state.players[ctx.self];
    if (!p || p.gold < SMITHY_COST) return true;

    markUsed(ctx, 'smithy');
    p.gold -= SMITHY_COST;
    ctx.push({ t: 'paid', player: ctx.self, gold: SMITHY_COST, reason: '대장간' });

    const got = draw(ctx.state, SMITHY_CARDS);
    p.hand.push(...got);
    ctx.push({ t: 'gained', player: ctx.self, cards: got.length, reason: '대장간' });
    return true;
  },
};
