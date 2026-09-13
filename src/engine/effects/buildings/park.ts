import { draw } from '../../rules/deck';
import type { GameHooks } from '../hooks';

export const PARK_CARDS = 2;

/** 공원 — 차례를 끝냈을 때 손이 비어 있으면 카드 2장. */
export const park: GameHooks = {
  onTurnEnd(ctx) {
    const p = ctx.state.players[ctx.self];
    if (!p || p.hand.length > 0) return;

    const got = draw(ctx.state, PARK_CARDS);
    p.hand.push(...got);
    ctx.push({ t: 'gained', player: ctx.self, cards: got.length, reason: '공원' });
  },
};
