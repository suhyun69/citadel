import type { GameHooks } from '../hooks';

/** 제국 보고 — 개인 금고에 남은 금화 1닢당 1점. */
export const imperial_treasury: GameHooks = {
  endGameScore: (ctx) => ctx.state.players[ctx.self]?.gold ?? 0,
};
