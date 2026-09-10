import { draw } from '../../rules/deck';
import type { GameHooks } from '../hooks';
import { abilityOption, markUsed, matches } from './_shared';

export const ARCHITECT_DRAW = 'architect.draw';
export const ARCHITECT_BUILD_LIMIT = 3;

/** 건축가 — 카드 2장을 더 받고, 건물을 3채까지 짓는다. */
export const architect: GameHooks = {
  modifyBuildLimit: () => ARCHITECT_BUILD_LIMIT,

  turnActions: (ctx) => abilityOption(ctx, ARCHITECT_DRAW),

  performAction(action, ctx) {
    if (!matches(action, ARCHITECT_DRAW)) return false;
    markUsed(ctx, ARCHITECT_DRAW);

    const p = ctx.state.players[ctx.self];
    if (!p) return true;
    const got = draw(ctx.state, 2);
    p.hand.push(...got);
    ctx.push({ t: 'gained', player: ctx.self, cards: got.length, reason: '건축가' });
    return true;
  },
};
