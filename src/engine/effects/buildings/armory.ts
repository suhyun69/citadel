import { isCityComplete } from '../../rules/build';
import { playerId, type CardId, type PlayerId } from '../../state/ids';
import type { CityEntry, GameState } from '../../state/game-state';
import type { GameHooks } from '../hooks';
import { isCard, isUse, markUsed } from './_shared';

export interface ArmoryTarget {
  player: PlayerId;
  card: CardId;
}

const isArmory = (entry: CityEntry): boolean => isCard(entry, 'armory');

/**
 * 병기고가 부술 수 있는 건물.
 *
 * 8번 캐릭터의 능력이 **아니므로** 외성·주교의 면역도 장성의 웃돈도 걸리지
 * 않는다. 걸리는 제한은 하나뿐이다 — 완성된 도시는 건드릴 수 없다
 * (howto.md 병기고).
 *
 * 병기고 자신은 목록에서 빠지고, 주인의 완성 여부도 **병기고를 뺀 채로** 센다.
 * 능력을 쓰는 순간 병기고는 이미 부서지기 때문이다. 덕분에 메뉴에 내놓을
 * 때와 실제로 고를 때가 같은 목록이 된다.
 */
export function armoryTargets(state: GameState, actor: PlayerId): ArmoryTarget[] {
  const out: ArmoryTarget[] = [];

  for (let i = 0; i < state.players.length; i++) {
    const owner = playerId(i);
    const p = state.players[owner];
    if (!p) continue;

    const mine = owner === actor;
    if (isCityComplete(state, owner, mine ? isArmory : undefined)) continue;

    for (const entry of p.city) {
      if (mine && isArmory(entry)) continue;
      out.push({ player: owner, card: entry.card });
    }
  }
  return out;
}

/** 병기고 — 자신을 부수면서 다른 건물 1채를 공짜로 부순다. */
export const armory: GameHooks = {
  turnActions: (ctx) =>
    !ctx.turn?.usedAbilities.includes('armory') && armoryTargets(ctx.state, ctx.self).length > 0
      ? [{ t: 'useBuilding', building: 'armory' }]
      : [],

  performAction(action, ctx) {
    if (!isUse(action, 'armory')) return false;
    markUsed(ctx, 'armory');

    const options = armoryTargets(ctx.state, ctx.self);
    if (options.length === 0) return true;

    ctx.ask({
      type: 'armoryTarget',
      player: ctx.self,
      text: '병기고를 부수면서 함께 파괴할 건물을 고르세요',
      options,
    });
    return true;
  },
};
