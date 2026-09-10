import type { GameHooks } from '../hooks';

/**
 * 도적 소굴 — 건설비용의 일부 또는 전부를 금화 대신 건물 카드로 낸다
 * (금화 1닢당 카드 1장).
 *
 * 이 효과는 **건설하는 순간** 필요하다. 그때 도적 소굴은 아직 손에 있어
 * 도시 기준 collectHooks 에 잡히지 않으므로, rules/build.ts 가 건설하려는
 * 카드의 정의에서 직접 이 훅을 꺼낸다.
 */
export const thieves_den: GameHooks = {
  paymentOptions: (def) =>
    def.id === 'thieves_den' ? [{ kind: 'cards', maxCards: def.cost ?? 0 }] : [],
};
