import { characterDef } from '@/data/types';
import { playerId } from '../../state/ids';
import type { GameHooks } from '../hooks';
import { abilityOption, markUsed, matches } from './_shared';

export const QUEEN_BONUS = 'queen.bonus';
export const QUEEN_GOLD = 3;
export const RANK_FOUR = 4;

/**
 * 왕비 — 옆자리에 공개된 4번 캐릭터가 있으면 금화 3닢.
 *
 * 9번이라 마지막에 호명되므로, 이 시점에는 4번이 이미 공개되어 있다
 * (암살당했더라도 호명 때 정체가 드러난다). 5명 미만 게임에는 쓸 수 없고,
 * 그 제약은 setup 의 MIN_PLAYERS_FOR 가 막는다.
 */
export const queen: GameHooks = {
  turnActions: (ctx) => (hasRankFourNeighbour(ctx) ? abilityOption(ctx, QUEEN_BONUS) : []),

  performAction(action, ctx) {
    if (!matches(action, QUEEN_BONUS)) return false;
    markUsed(ctx, QUEEN_BONUS);
    if (!hasRankFourNeighbour(ctx)) return true;

    const p = ctx.state.players[ctx.self];
    if (!p) return true;
    p.gold += QUEEN_GOLD;
    ctx.push({ t: 'gained', player: ctx.self, gold: QUEEN_GOLD, reason: '왕비 — 옆자리 4번' });
    return true;
  },
};

function hasRankFourNeighbour(ctx: { state: import('../../state/game-state').GameState; self: number }): boolean {
  const n = ctx.state.players.length;
  const neighbours = [playerId((ctx.self - 1 + n) % n), playerId((ctx.self + 1) % n)];

  return neighbours.some((id) => {
    const slot = ctx.state.players[id]?.character;
    return slot?.revealed === true && characterDef(slot.characterId).rank === RANK_FOUR;
  });
}
