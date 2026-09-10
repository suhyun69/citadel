import type { GameHooks } from '../hooks';

/** 동상 — 게임이 끝났을 때 왕관을 가지고 있으면 5점. */
export const statue: GameHooks = {
  endGameScore: (ctx) => (ctx.state.crowned === ctx.self ? 5 : 0),
};
