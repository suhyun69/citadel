import type { GameHooks } from '../hooks';

/** 지도 보관실 — 손에 든 건물 카드 1장당 1점. */
export const map_room: GameHooks = {
  endGameScore: (ctx) => ctx.state.players[ctx.self]?.hand.length ?? 0,
};
