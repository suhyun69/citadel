import type { GameHooks } from '../hooks';

/**
 * 도서관 — 자원 얻기로 카드를 뽑으면 가져간 카드를 전부 손에 든다.
 *
 * `keep` 을 `draw` 에 맞추는 것이지 뽑는 장수를 바꾸는 게 아니다. 그래서
 * 훅 합성 순서에서 draw 를 바꾸는 쪽(천문대, 후순위)보다 **뒤에** 와야 한다.
 * 그 계약은 registry.ts 의 EFFECT_ORDER 가 지킨다.
 */
export const library: GameHooks = {
  modifyGatherCards: (plan) => ({ draw: plan.draw, keep: plan.draw }),
};
