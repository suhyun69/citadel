import { playerId, type PlayerId } from '../../state/ids';
import type { GameState } from '../../state/game-state';
import type { GameHooks } from '../hooks';
import { abilityOption, grantKindIncome, isUsed, markUsed, matches } from './_shared';

export const EMPEROR_INCOME = 'emperor.income';
export const EMPEROR_CROWN = 'emperor.crown';

/**
 * 왕관을 줄 수 있는 상대.
 *
 * 자기 자신도, 지금 왕관을 들고 있는 사람도 받을 수 없다(howto.md:306).
 * 4명 이상이면 항상 한 명 이상 남으므로, 이 능력이 교착을 만들지 않는다 —
 * 황제가 2명 게임에 못 들어가는 이유이기도 하다.
 */
export function crownTargets(state: GameState, self: PlayerId): PlayerId[] {
  const out: PlayerId[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const other = playerId(i);
    if (other !== self && other !== state.crowned) out.push(other);
  }
  return out;
}

/**
 * 황제 — 왕관을 남에게 **떠넘기고** 그 대가를 받아낸다.
 *
 * 왕·대공이 왕관을 자기에게 가져오는 것과 정반대다. 규칙이 "반드시" 라고
 * 하므로 차례를 끝내기 전에 반드시 써야 하고(blocksEndTurn), 그래서 시점만
 * 고를 수 있다 — 건설 전에 넘길지 후에 넘길지가 실제 선택이다.
 *
 * 마녀가 황제에게 마법을 걸면 왕관을 줄 상대도 마녀가 정하고 자원도 마녀가
 * 가져간다(howto.md:230). 그것은 여기서 따로 처리하지 않는다 — 마녀의
 * 차례에는 `actingAs` 로 이 훅이 마녀에게 붙고 `ctx.self` 가 마녀가 되므로
 * 저절로 그렇게 된다.
 */
export const emperor: GameHooks = {
  incomeKind: 'noble',

  turnActions: (ctx) => [
    ...abilityOption(ctx, EMPEROR_INCOME),
    ...(crownTargets(ctx.state, ctx.self).length > 0 ? abilityOption(ctx, EMPEROR_CROWN) : []),
  ],

  // "반드시" 이므로 아직 안 넘겼다면 차례를 끝낼 수 없다. 줄 상대가 없을
  // 때는 막지 않는다 — 그러면 아무 행동도 못 하고 갇힌다.
  blocksEndTurn: (ctx) =>
    !isUsed(ctx, EMPEROR_CROWN) && crownTargets(ctx.state, ctx.self).length > 0,

  performAction(action, ctx) {
    if (matches(action, EMPEROR_INCOME)) {
      grantKindIncome(ctx, 'noble', EMPEROR_INCOME);
      return true;
    }
    if (!matches(action, EMPEROR_CROWN)) return false;

    markUsed(ctx, EMPEROR_CROWN);
    const options = crownTargets(ctx.state, ctx.self);
    if (options.length === 0) return true;

    ctx.ask({
      type: 'pickPlayer',
      player: ctx.self,
      text: '왕관을 넘길 상대를 고르세요 (그 대가로 금화 1닢이나 카드 1장을 받습니다)',
      purpose: 'emperorCrown',
      options,
    });
    return true;
  },

  /**
   * 암살당한 황제는 차례가 없지만, 라운드가 끝날 때 대리인을 통해 왕관만
   * 옮긴다. 이때는 대가를 받지 않는다(howto.md:308) — 그 구분은 resolver 가
   * "진행 중인 차례가 있는가" 로 판정한다.
   */
  onRoundEnd(ctx) {
    const slot = ctx.state.players[ctx.self]?.character;
    if (!slot?.killed) return;

    const options = crownTargets(ctx.state, ctx.self);
    if (options.length === 0) return;

    ctx.ask({
      type: 'pickPlayer',
      player: ctx.self,
      text: '황제의 대리인: 왕관을 넘길 상대를 고르세요',
      purpose: 'emperorCrown',
      options,
    });
  },
};
