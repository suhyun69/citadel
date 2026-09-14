import type { GameHooks } from '../hooks';

export const SECRET_VAULT_POINTS = 3;

/**
 * 비밀 금고 — 도시에 설 수 없고, 손에 든 채로 3점을 준다.
 *
 * 건설 금지는 여기서 막지 않는다. 정의의 `cost` 가 null 이라
 * `isConstructible` 이 이미 걸러내며, 그쪽이 "건설비용이 없는 카드" 라는
 * 사실 하나로 일관되게 처리된다.
 */
export const secret_vault: GameHooks = {
  endGameScoreInHand: () => SECRET_VAULT_POINTS,
};
