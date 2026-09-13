import { makeCtx } from '../effects/ctx';
import { collectHooks } from '../effects/registry';
import { defIdOf, defOf, playerId, type CardId, type PlayerId } from '../state/ids';
import type { CityEntry, GameState } from '../state/game-state';
import { isCityComplete } from './build';

/**
 * 8번 캐릭터(장군)의 능력이 이 건물에 닿을 수 있는가.
 *
 * 면역은 **대상 소유자의** 훅에서 나온다 — 주교는 자기 도시 전체를,
 * 외성은 자기 카드 한 장만 지킨다.
 */
export function isRank8Immune(state: GameState, owner: PlayerId, entry: CityEntry): boolean {
  const ctx = makeCtx(state, owner);
  return collectHooks(state, owner).some((h) => h.immuneToRank8?.(entry, ctx) === true);
}

/** 파괴 비용 = 건설비용 − 1. 비용 1짜리는 공짜다 (howto.md 장군). */
export const basePrice = (card: CardId): number => Math.max(0, (defOf(card).cost ?? 0) - 1);

/** 장성처럼 8번 능력에 웃돈을 붙이는 효과의 합. */
export function rank8Surcharge(state: GameState, owner: PlayerId, entry: CityEntry): number {
  const ctx = makeCtx(state, owner);
  return collectHooks(state, owner).reduce((n, h) => n + (h.rank8Surcharge?.(entry, ctx) ?? 0), 0);
}

/** 실제로 내야 하는 파괴 비용. 장성이 있으면 그만큼 비싸진다. */
export function destroyPrice(state: GameState, owner: PlayerId, entry: CityEntry): number {
  return basePrice(entry.card) + rank8Surcharge(state, owner, entry);
}

export interface DestroyTarget {
  player: PlayerId;
  card: CardId;
  price: number;
}

/**
 * 파괴할 수 있는 건물 목록.
 *
 * ERRATA: howto.md 는 "완성된 도시의 건물은 절대로 파괴할 수 없습니다.
 * 하지만 자기 도시의 건물은 파괴할 수 있습니다." 라고만 한다. 자기 도시가
 * 완성된 경우를 명시하지 않으므로, "절대로" 라는 강한 표현을 따라
 * **완성된 도시는 자기 것이라도 제외**한다.
 */
export function destroyTargets(state: GameState, actor: PlayerId): DestroyTarget[] {
  const gold = state.players[actor]?.gold ?? 0;
  const out: DestroyTarget[] = [];

  for (let i = 0; i < state.players.length; i++) {
    const owner = playerId(i);
    if (isCityComplete(state, owner)) continue;

    const p = state.players[owner];
    if (!p) continue;

    for (const entry of p.city) {
      if (isRank8Immune(state, owner, entry)) continue;
      const price = destroyPrice(state, owner, entry);
      if (price > gold) continue;
      out.push({ player: owner, card: entry.card, price });
    }
  }
  return out;
}

/** 육군대장이 점령할 수 있는 건설비용 상한 (howto.md:409). */
export const CAPTURE_MAX_COST = 3;

/**
 * 점령할 수 있는 건물.
 *
 * 파괴와 달리 **자기 도시로 가져오는** 것이라 제약이 하나 더 붙는다 —
 * 이미 같은 이름이 자기 도시에 있으면 가져올 수 없다(howto.md:411).
 */
export function captureTargets(state: GameState, actor: PlayerId): DestroyTarget[] {
  const me = state.players[actor];
  if (!me) return [];

  const mine = new Set(me.city.map((e) => defIdOf(e.card)));
  const out: DestroyTarget[] = [];

  for (let i = 0; i < state.players.length; i++) {
    const owner = playerId(i);
    if (owner === actor) continue;
    if (isCityComplete(state, owner)) continue;

    for (const entry of state.players[owner]?.city ?? []) {
      const cost = defOf(entry.card).cost ?? 0;
      if (cost > CAPTURE_MAX_COST) continue;
      if (mine.has(defIdOf(entry.card))) continue;
      if (isRank8Immune(state, owner, entry)) continue;

      const price = cost + rank8Surcharge(state, owner, entry);
      if (price > me.gold) continue;
      out.push({ player: owner, card: entry.card, price });
    }
  }
  return out;
}
