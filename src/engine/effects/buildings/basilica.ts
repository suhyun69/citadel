import { defOf } from '../../state/ids';
import type { GameHooks } from '../hooks';

/**
 * 바실리카 — 게임이 끝났을 때 건설비용이 홀수인 건물 1채당 1점.
 *
 * 바실리카 자신은 4닢이라 스스로를 세지 않는다. 건설비용이 없는 카드
 * (비밀 금고)는 애초에 도시에 설 수 없으므로 여기 들어올 일이 없다.
 */
export const basilica: GameHooks = {
  endGameScore(ctx) {
    const city = ctx.state.players[ctx.self]?.city ?? [];
    return city.filter((entry) => (defOf(entry.card).cost ?? 0) % 2 === 1).length;
  },
};
