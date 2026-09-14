import { countIncome } from '../../rules/income';
import { playerId, type PlayerId } from '../../state/ids';
import type { GameState } from '../../state/game-state';
import type { GameHooks } from '../hooks';
import { abilityOption, markUsed, matches } from './_shared';

export const ABBOT_INCOME = 'abbot.income';
export const ABBOT_TITHE = 'abbot.tithe';

/**
 * 지금 금화가 가장 많은 플레이어들.
 *
 * 수도원장 자신이 그중에 있으면 빈 배열을 돌려준다 — 규칙이 "수도원장이
 * 가장 금화가 많은 플레이어가 아니라면" 이라고 못 박기 때문이다(howto.md:341).
 */
export function tithePayers(state: GameState, abbot: PlayerId): PlayerId[] {
  const top = state.players.reduce((n, p) => Math.max(n, p.gold), 0);
  if (top <= 0) return [];
  if ((state.players[abbot]?.gold ?? 0) >= top) return [];

  const out: PlayerId[] = [];
  for (let i = 0; i < state.players.length; i++) {
    if ((state.players[playerId(i)]?.gold ?? 0) === top) out.push(playerId(i));
  }
  return out;
}

/**
 * 수도원장 — 종교 건물 수만큼을 금화와 카드로 **나눠** 받고, 최고 부자에게서
 * 금화 1닢을 걷는다.
 *
 * 수입을 금화/카드 중 하나로 고르는 것이 아니라 임의로 섞을 수 있다는 점이
 * 다른 수입 캐릭터와 다르다(howto.md:339). 그래서 grantKindIncome 을 쓰지
 * 않고 배분을 직접 묻는다.
 */
export const abbot: GameHooks = {
  incomeKind: 'religious',

  turnActions: (ctx) => [
    ...abilityOption(ctx, ABBOT_INCOME),
    ...(tithePayers(ctx.state, ctx.self).length > 0 ? abilityOption(ctx, ABBOT_TITHE) : []),
  ],

  performAction(action, ctx) {
    if (matches(action, ABBOT_INCOME)) {
      markUsed(ctx, ABBOT_INCOME);
      const total = countIncome(ctx.state, ctx.self, 'religious', ctx);
      if (total <= 0) return true;

      ctx.ask({
        type: 'abbotIncome',
        player: ctx.self,
        text: `종교 건물 ${total}채 — 금화와 카드로 나눠 받으세요`,
        total,
      });
      return true;
    }

    if (matches(action, ABBOT_TITHE)) {
      markUsed(ctx, ABBOT_TITHE);
      const payers = tithePayers(ctx.state, ctx.self);
      if (payers.length === 0) return true;

      // 최고 부자가 한 명뿐이면 고를 것이 없다.
      if (payers.length === 1) {
        takeTithe(ctx.state, ctx.self, payers[0] as PlayerId);
        return true;
      }

      ctx.ask({
        type: 'pickPlayer',
        player: ctx.self,
        text: '금화 1닢을 받아낼 상대를 고르세요 (금화가 가장 많은 플레이어)',
        purpose: 'abbotTax',
        options: payers,
      });
      return true;
    }
    return false;
  },
};

export const TITHE = 1;

/**
 * 최고 부자에게서 금화 1닢. 거절할 수 없다 ("반드시 ... 줘야 합니다").
 *
 * `stolen` 으로 적지 않는다 — 그 이벤트는 대가 없이 가져가는 도둑의 것이고,
 * 이쪽은 규칙이 강제하는 상납이다. 낸 쪽과 받은 쪽을 각각 남긴다.
 */
export function takeTithe(state: GameState, abbot: PlayerId, from: PlayerId): void {
  const rich = state.players[from];
  const me = state.players[abbot];
  if (!rich || !me || rich.gold < TITHE) return;

  rich.gold -= TITHE;
  me.gold += TITHE;
  state.log.push({ t: 'paid', player: from, gold: TITHE, reason: '수도원장 상납' });
  state.log.push({ t: 'gained', player: abbot, gold: TITHE, reason: '수도원장 상납' });
}
