import { playerId } from '../../types/ids';
import type { GameHooks } from '../hooks';
import { abilityOption, markUsed, matches } from './_shared';

export const MAGIC = 'magician.magic';

/** 마술사 — 손패를 통째로 바꾸거나, 원하는 만큼 버리고 같은 수를 새로 뽑는다. */
export const magician: GameHooks = {
  turnActions: (ctx) => abilityOption(ctx, MAGIC),

  performAction(action, ctx) {
    if (!matches(action, MAGIC)) return false;
    markUsed(ctx, MAGIC);

    const canSwapWith = ctx.state.players
      .map((_, i) => playerId(i))
      .filter((id) => id !== ctx.self);

    ctx.ask({
      type: 'magicianMode',
      player: ctx.self,
      prompt: '손패를 교환하거나, 버리고 새로 뽑습니다',
      canSwapWith,
      handSize: ctx.state.players[ctx.self]?.hand.length ?? 0,
    });
    return true;
  },
};
