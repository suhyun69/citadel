import type { CharacterId } from '@/data/types';
import type { GameState } from '../../state/game-state';
import type { GameHooks } from '../hooks';
import { abilityOption, charactersInGame, markUsed, matches, rankOf } from './_shared';

export const BLACKMAIL = 'blackmailer.tokens';
export const BLACKMAILER_ID = 'blackmailer' as CharacterId;

/**
 * 협박 토큰을 붙일 수 있는 캐릭터.
 *
 * 1번 캐릭터, 암살당한 캐릭터, 마법에 걸린 캐릭터는 제외한다. 영장이 붙은
 * 캐릭터는 협박할 수 있다(howto.md:270). 자기 자신(2번)도 뺀다 — 토큰은
 * 호명될 때 정산되므로 이미 지나간 순번에 붙이면 아무 일도 일어나지 않는다.
 */
export function blackmailTargets(state: GameState, self: CharacterId | undefined): CharacterId[] {
  const declared = state.action?.declared;
  return charactersInGame(state).filter(
    (id) =>
      rankOf(id) !== 1 &&
      id !== self &&
      id !== declared?.assassinTarget &&
      id !== declared?.witchTarget,
  );
}

/**
 * 협박범 — 캐릭터 둘에 토큰을 붙이고, 뇌물을 안 바치면 금고를 턴다.
 *
 * 치안판사의 영장과 같은 모양이되 허풍이 하나 적다(3장 중 1장 → 2장 중 1장).
 * 다른 점은 정산 시점이다 — 영장은 **건설할 때** 걸리지만 협박은 **호명될 때**
 * 곧바로 걸리고, 당한 쪽이 먼저 뇌물로 빠져나갈 기회를 얻는다.
 */
export const blackmailer: GameHooks = {
  turnActions: (ctx) => abilityOption(ctx, BLACKMAIL),

  performAction(action, ctx) {
    if (!matches(action, BLACKMAIL)) return false;
    markUsed(ctx, BLACKMAIL);

    const self = ctx.state.players[ctx.self]?.character?.characterId;
    const options = blackmailTargets(ctx.state, self);
    if (options.length < 2) return true;

    ctx.ask({
      type: 'blackmailTokens',
      player: ctx.self,
      text: '협박 토큰을 붙일 캐릭터 2명을 고르세요 (그중 하나만 꽃 자수)',
      options,
    });
    return true;
  },
};
