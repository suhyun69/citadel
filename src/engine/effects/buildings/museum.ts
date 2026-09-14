import type { GameHooks } from '../hooks';
import { isCard, isUse, markUsed, onceOption } from './_shared';

/**
 * 박물관 — 차례마다 한 번 손패 1장을 아래에 깔고, 게임이 끝나면 1장당 1점.
 *
 * 깔린 카드는 `CityEntry.beneath` 에 들어간다. 점령·교환으로 박물관이
 * 움직이면 따라가고, 파괴되면 함께 더미 아래로 간다 — 그 두 가지는
 * 도시에서 엔트리를 옮기는 쪽(discardEntry 와 점령 처리)이 책임진다.
 */
export const museum: GameHooks = {
  turnActions: (ctx) =>
    onceOption(ctx, 'museum', (ctx.state.players[ctx.self]?.hand.length ?? 0) > 0),

  performAction(action, ctx) {
    if (!isUse(action, 'museum')) return false;
    const hand = ctx.state.players[ctx.self]?.hand ?? [];
    if (hand.length === 0) {
      markUsed(ctx, 'museum');
      return true;
    }

    markUsed(ctx, 'museum');
    ctx.ask({
      type: 'tuckCard',
      player: ctx.self,
      text: '박물관 아래에 깔 카드를 1장 고르세요',
      options: [...hand],
    });
    return true;
  },

  endGameScore(ctx) {
    const city = ctx.state.players[ctx.self]?.city ?? [];
    return city
      .filter((entry) => isCard(entry, 'museum'))
      .reduce((n, entry) => n + (entry.beneath?.length ?? 0), 0);
  },
};
