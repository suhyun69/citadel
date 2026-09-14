import type { GameHooks } from '../hooks';

export const GOLD_MINE_BONUS = 1;

/**
 * 금광 — 자원 얻기로 **금화를** 고르면 1닢을 더 받는다.
 *
 * 카드를 고른 쪽에는 아무 영향이 없다. 마녀에게 걸리거나 협박당해 차례가
 * 막힌 플레이어도 자원 얻기 행동은 하므로 이 효과는 그대로 작동한다
 * (howto.md 마녀·협박범: "자원 얻기 행동 때 적용되는 건물").
 */
export const gold_mine: GameHooks = {
  modifyGatherGold: (gold) => gold + GOLD_MINE_BONUS,
};
