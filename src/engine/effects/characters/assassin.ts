import type { GameHooks } from '../hooks';
import { abilityOption, charactersInGame, markUsed, matches } from './_shared';

export const ASSASSINATE = 'assassin.kill';

/**
 * 암살자 — 다른 캐릭터를 지목해 차례를 쉬게 만든다.
 *
 * 지목은 공개 선언이다(howto.md:220). 따라서 대상이 된 플레이어가 자기
 * 캐릭터를 아는 이상 스스로 죽은 것도 안다 — 정보 누출이 아니라 규칙이다.
 * 자기 자신(1번)은 지목할 수 없다.
 */
export const assassin: GameHooks = {
  turnActions: (ctx) => abilityOption(ctx, ASSASSINATE),

  performAction(action, ctx) {
    if (!matches(action, ASSASSINATE)) return false;
    markUsed(ctx, ASSASSINATE);

    const self = ctx.state.players[ctx.self]?.character?.characterId;
    const options = charactersInGame(ctx.state).filter((id) => id !== self);

    ctx.ask({
      type: 'namedCharacter',
      player: ctx.self,
      prompt: '암살할 캐릭터를 지목하세요',
      purpose: 'assassinate',
      options,
    });
    return true;
  },
};
