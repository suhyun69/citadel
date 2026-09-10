import type { GameHooks } from '../hooks';
import { isUse, markUsed, onceOption } from './_shared';

export const LABORATORY_GOLD = 2;

/** 실험실 — 차례마다 한 번, 손에 든 카드 1장을 버리고 금화 2닢을 받는다. */
export const laboratory: GameHooks = {
  turnActions: (ctx) =>
    onceOption(ctx, 'laboratory', (ctx.state.players[ctx.self]?.hand.length ?? 0) > 0),

  performAction(action, ctx) {
    if (!isUse(action, 'laboratory')) return false;
    const hand = ctx.state.players[ctx.self]?.hand ?? [];
    if (hand.length === 0) return true;

    markUsed(ctx, 'laboratory');
    ctx.ask({
      type: 'discardCard',
      player: ctx.self,
      prompt: `실험실: 카드 1장을 버리고 금화 ${LABORATORY_GOLD}닢을 받습니다`,
      source: 'laboratory',
      options: [...hand],
    });
    return true;
  },
};
