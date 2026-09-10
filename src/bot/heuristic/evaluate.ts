import { BUILDING_KINDS, characterDef, type BuildingKind, type CharacterId } from '@/data/types';
import { defOf, type CardId, type PlayerId } from '@/engine/types/ids';
import type { PlayerView } from '@/engine/view';

/** 내 도시에 이미 있는 건물 정의 id. 같은 이름은 (채석장 없이는) 못 짓는다. */
export const cityDefIds = (view: PlayerView): Set<string> =>
  new Set(view.me.city.map((e) => defOf(e.card).id));

export const cityKinds = (view: PlayerView): Set<BuildingKind> =>
  new Set(view.me.city.map((e) => defOf(e.card).kind));

export const missingKinds = (view: PlayerView): BuildingKind[] => {
  const have = cityKinds(view);
  return BUILDING_KINDS.filter((k) => !have.has(k));
};

/** 도시 완성까지 남은 채수. */
export const toGo = (view: PlayerView): number =>
  Math.max(0, view.targetCitySize - view.me.city.length);

/** 가장 앞서 있는 상대의 도시 채수. */
export const leaderCitySize = (view: PlayerView): number =>
  view.opponents.reduce((n, o) => Math.max(n, o.city.length), 0);

export const leaderId = (view: PlayerView): PlayerId | null => {
  let best: { id: PlayerId; size: number } | null = null;
  for (const o of view.opponents) {
    if (!best || o.city.length > best.size) best = { id: o.id, size: o.city.length };
  }
  return best?.id ?? null;
};

export const richestOpponentGold = (view: PlayerView): number =>
  view.opponents.reduce((n, o) => Math.max(n, o.gold), 0);

export const biggestOpponentHand = (view: PlayerView): number =>
  view.opponents.reduce((n, o) => Math.max(n, o.handCount), 0);

/**
 * 손에 든 카드 한 장의 값어치.
 *
 * 건설비용은 그대로 점수라 비쌀수록 좋지만, 못 지으면 0점이다. 그래서
 * "지금 감당 가능한가" 와 "5종 보너스를 메우는가" 를 함께 본다.
 */
export function cardValue(view: PlayerView, card: CardId): number {
  const def = defOf(card);
  if (cityDefIds(view).has(def.id)) return -5; // 이미 있는 이름 — 거의 쓸모없다
  if (def.cost === null) return -5;

  const missing = missingKinds(view);
  let v = def.cost * 0.6;
  if (missing.includes(def.kind)) v += 2.5;
  if (def.kind === 'unique') v += 1.5; // 대개 추가 점수가 붙는다
  // 지금 도저히 못 낼 비용이면 값을 깎는다
  if (def.cost > view.me.gold + 3) v -= 1.5;
  return v;
}

/** 각 캐릭터가 나에게 주는 대략적 기대값. 선택 단계에 쓴다. */
export function characterValue(view: PlayerView, id: CharacterId): number {
  const kinds = view.me.city.map((e) => defOf(e.card).kind);
  const count = (k: BuildingKind): number => kinds.filter((x) => x === k).length;
  const hand = view.me.hand.length;
  const buildable = view.me.hand.filter((c) => (defOf(c).cost ?? 99) <= view.me.gold).length;
  const threat = leaderCitySize(view) >= view.targetCitySize - 2 ? 1 : 0;

  switch (id) {
    case 'architect':
      // 카드 2장 + 건물 3채. 손패와 금화가 받쳐줄수록 강하다.
      return 3 + Math.min(buildable, 3) * 1.2 + Math.min(hand, 4) * 0.3;
    case 'king':
      // 귀족 수입 + 왕관(다음 라운드 첫 선택권)
      return 1.5 + count('noble') * 1.1;
    case 'bishop':
      // 종교 수입 + 장군 방어. 앞서 있을수록 방어가 값지다.
      return count('religious') * 1.1 + (toGo(view) <= 2 ? 2 : 0.5);
    case 'merchant':
      return 1.2 + count('trade') * 1.1;
    case 'warlord':
      return count('military') * 1.1 + threat * 2;
    case 'assassin':
      return 2 + threat * 2;
    case 'thief':
      return 0.8 + richestOpponentGold(view) * 0.25;
    case 'magician':
      return 0.5 + Math.max(0, biggestOpponentHand(view) - hand) * 0.6;
    default:
      return characterDef(id).rank * 0.1;
  }
}
