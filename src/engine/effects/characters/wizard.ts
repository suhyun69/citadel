import { playerId } from '../../state/ids';
import type { GameHooks } from '../hooks';
import { abilityOption, markUsed, matches } from './_shared';

export const WIZARD_TAKE = 'wizard.take';

/**
 * 마법사 — 다른 플레이어의 손패를 보고 1장을 가져온다.
 *
 * 상대를 **먼저** 고르고 그 다음 손패를 보는 순서를 지킨다. 한 번에
 * (상대, 카드) 쌍을 고르게 하면 모든 손패를 동시에 보는 셈이라 규칙보다
 * 많은 정보를 얻게 된다.
 *
 * 가져온 카드를 그 자리에서 지으면 이번 차례의 건설 횟수에 포함되지
 * 않는다(howto.md:283). 또 마법사는 자기 차례에 한해 동명 건물을 지을 수 있다.
 */
export const wizard: GameHooks = {
  allowsDuplicateTitle: () => true,

  turnActions(ctx) {
    const hasTarget = ctx.state.players.some((p) => p.id !== ctx.self && p.hand.length > 0);
    return hasTarget ? abilityOption(ctx, WIZARD_TAKE) : [];
  },

  performAction(action, ctx) {
    if (!matches(action, WIZARD_TAKE)) return false;
    markUsed(ctx, WIZARD_TAKE);

    const options = ctx.state.players
      .filter((p) => p.id !== ctx.self && p.hand.length > 0)
      .map((p) => playerId(p.id));
    if (options.length === 0) return true;

    ctx.ask({
      type: 'pickPlayer',
      player: ctx.self,
      text: '손패를 볼 플레이어를 고르세요',
      purpose: 'wizardTake',
      options,
    });
    return true;
  },
};
