import type { GameHooks } from '../hooks';
import { abilityOption, charactersInGame, markUsed, matches } from './_shared';

export const ISSUE_WARRANTS = 'magistrate.warrants';

/**
 * 치안판사 — 캐릭터 셋에게 영장을 붙이고, 인장 찍힌 쪽이 금화를 내고 짓는
 * 첫 건물을 몰수한다.
 *
 * 이 게임에서 **남의 차례에 끼어드는 유일한 카드**다. 몰수 여부는 선택
 * 사항이므로(howto.md:242) 건설이 일어나는 순간 치안판사에게 질문이 가고,
 * 그동안 건설은 멈춰 있는다. `pending.player` 가 차례 주인과 달라도 되도록
 * 설계해 둔 자리가 여기서 처음 쓰인다.
 */
export const magistrate: GameHooks = {
  turnActions: (ctx) => abilityOption(ctx, ISSUE_WARRANTS),

  performAction(action, ctx) {
    if (!matches(action, ISSUE_WARRANTS)) return false;
    markUsed(ctx, ISSUE_WARRANTS);

    const self = ctx.state.players[ctx.self]?.character?.characterId;
    const options = charactersInGame(ctx.state).filter((id) => id !== self);
    if (options.length < 3) return true;

    ctx.ask({
      type: 'warrants',
      player: ctx.self,
      text: '영장을 붙일 캐릭터 3명을 고르세요 (그중 하나에만 인장)',
      options,
    });
    return true;
  },
};
