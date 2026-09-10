import type { GameHooks } from '../hooks';
import { abilityOption, charactersInGame, holderOf, markUsed, matches, rankOf } from './_shared';

export const ROB = 'thief.rob';

/**
 * 도둑 — 지목한 캐릭터가 공개될 때 개인 금고를 통째로 가져온다.
 *
 * 1번 캐릭터와 암살당한 캐릭터에게서는 훔칠 수 없다(howto.md:253).
 * 암살자가 2번보다 먼저 움직이므로, 지목 시점에 이미 암살 선언이 끝나 있다.
 */
export const thief: GameHooks = {
  turnActions: (ctx) => abilityOption(ctx, ROB),

  performAction(action, ctx) {
    if (!matches(action, ROB)) return false;
    markUsed(ctx, ROB);

    const self = ctx.state.players[ctx.self]?.character?.characterId;
    const assassinated = ctx.state.action?.declared.assassinTarget;
    const options = charactersInGame(ctx.state).filter(
      (id) => id !== self && rankOf(id) !== 1 && id !== assassinated,
    );

    if (options.length === 0) return true; // 훔칠 대상이 없다 — 능력만 소모

    ctx.ask({
      type: 'namedCharacter',
      player: ctx.self,
      prompt: '금화를 훔쳐올 캐릭터를 지목하세요',
      purpose: 'rob',
      options,
    });
    return true;
  },

  onCharacterRevealed(who, character, ctx) {
    const target = ctx.state.action?.declared.thiefTarget;
    if (!target || character !== target) return;
    if (who === ctx.self) return;
    if (holderOf(ctx.state, character) !== who) return;

    const victim = ctx.state.players[who];
    const me = ctx.state.players[ctx.self];
    if (!victim || !me || victim.gold <= 0) return;

    const amount = victim.gold;
    victim.gold = 0;
    me.gold += amount;
    ctx.push({ t: 'stolen', by: ctx.self, from: who, gold: amount });
  },
};
