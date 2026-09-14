import type { GameHooks } from '../hooks';
import { isCard } from './_shared';

/** 기념물을 지을 수 없게 되는 도시 규모 (howto.md 기념물). */
export const MONUMENT_MAX_CITY = 5;
/** 도시 완성 판정에서 기념물이 세어지는 채수. */
export const MONUMENT_WEIGHT = 2;

/**
 * 기념물 — 늦게는 지을 수 없지만, 일단 서면 도시를 두 채 몫으로 채운다.
 *
 * 두 효과가 정반대 방향이라 순서가 중요하다. 건설 제한은 **카드 수** 로 세고
 * (아직 기념물이 서기 전이다), 완성 판정은 **가중치** 로 센다. 제한 쪽까지
 * 가중치로 세면 기념물을 세운 뒤 다른 건물이 막히는 엉뚱한 규칙이 된다.
 */
export const monument: GameHooks = {
  canBeBuilt: (_def, ctx) =>
    (ctx.state.players[ctx.self]?.city.length ?? 0) < MONUMENT_MAX_CITY,

  citySizeWeight: (entry) => (isCard(entry, 'monument') ? MONUMENT_WEIGHT : 1),
};
