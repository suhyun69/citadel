import type { GameState } from '../state/game-state';
import type { PlayerId } from '../state/ids';

export const PROPERTY_TAX = 1;
const TAX_COLLECTOR = 'tax_collector';

/**
 * 세리가 판에 있는가.
 *
 * 세리를 **고른 사람이 있는지**가 아니라 **조합에 들어 있는지**를 본다 —
 * 이번 라운드에 세리가 나타나지 않았더라도 재산세는 내야 한다(howto.md:442).
 */
export const taxInPlay = (state: GameState): boolean =>
  state.config.characterIds.some((id) => id === TAX_COLLECTOR);

/**
 * 건물 1채에 대한 재산세를 세리 토큰 위에 올린다.
 *
 * 건설비용을 내지 않고 지은 건물도 과세 대상이지만, **건설을 마친 뒤 금고가
 * 비어 있으면 내지 않는다**(howto.md:440). 그래서 지불이 전부 끝난 다음에
 * 부른다.
 */
export function payPropertyTax(state: GameState, player: PlayerId): void {
  if (!taxInPlay(state)) return;

  const p = state.players[player];
  if (!p || p.gold < PROPERTY_TAX) return;

  p.gold -= PROPERTY_TAX;
  state.taxPot = (state.taxPot ?? 0) + PROPERTY_TAX;
  state.log.push({ t: 'paid', player, gold: PROPERTY_TAX, reason: '재산세' });
}
