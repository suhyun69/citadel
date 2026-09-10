import type { GameHooks } from '../hooks';

/** 드래곤 게이트 — 게임이 종료되면 추가로 2점. */
export const dragon_gate: GameHooks = {
  endGameScore: () => 2,
};
