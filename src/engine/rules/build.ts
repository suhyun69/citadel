import { buildingDef, isConstructible, type BuildingDef } from '@/data/types';
import { BUILDING_EFFECTS, collectHooks } from '../effects/registry';
import type { EffectCtx, GameHooks } from '../effects/hooks';
import { defIdOf, defOf, type CardId, type PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';

/** 이 건물의 실제 건설비용 (공장 등 효과 반영). 음수로 내려가지 않는다. */
export function buildCost(state: GameState, player: PlayerId, def: BuildingDef, ctx: EffectCtx): number {
  if (!isConstructible(def)) return Number.POSITIVE_INFINITY;
  let cost = def.cost;
  for (const h of collectHooks(state, player)) {
    if (h.modifyBuildCost) cost = h.modifyBuildCost(cost, def, ctx);
  }
  return Math.max(0, cost);
}

/** 이미 도시에 이름이 같은 건물이 있는가. */
export function hasSameTitle(state: GameState, player: PlayerId, def: BuildingDef): boolean {
  const p = state.players[player];
  if (!p) return false;
  return p.city.some((e) => defIdOf(e.card) === def.id);
}

/** 동명 건물 건설이 허용되는가 (채석장). */
export function allowsDuplicate(
  state: GameState,
  player: PlayerId,
  def: BuildingDef,
  ctx: EffectCtx,
): boolean {
  for (const h of collectHooks(state, player)) {
    if (h.allowsDuplicateTitle?.(def, ctx)) return true;
  }
  return false;
}

/**
 * 건설비용 중 카드로 낼 수 있는 최대 장수 (도적 소굴).
 *
 * 이 효과는 **건설하는 카드 자신**에게서 나온다. 그 카드는 아직 손에 있어
 * collectHooks(도시 기준)에 잡히지 않으므로, 정의에서 직접 훅을 꺼내야 한다.
 * 지불에 쓸 수 있는 카드에는 건설 중인 그 카드 자신이 빠진다.
 */
export function cardPaymentAllowance(
  state: GameState,
  player: PlayerId,
  def: BuildingDef,
  ctx: EffectCtx,
): number {
  const own = (BUILDING_EFFECTS as Record<string, GameHooks | undefined>)[def.id];
  const options = own?.paymentOptions?.(def, ctx) ?? [];
  const allowed = options
    .filter((o) => o.kind === 'cards')
    .reduce((n, o) => Math.max(n, o.maxCards), 0);
  const usable = Math.max(0, (state.players[player]?.hand.length ?? 0) - 1);
  return Math.min(allowed, usable);
}

export interface BuildCheck {
  ok: boolean;
  cost: number;
  /** 0 보다 크면 건설 시 지불 방식을 물어야 한다. */
  maxCards: number;
  reason?: 'notConstructible' | 'duplicate' | 'tooExpensive' | 'limitReached';
}

export function canBuild(
  state: GameState,
  player: PlayerId,
  card: CardId,
  ctx: EffectCtx,
): BuildCheck {
  const def = buildingDef(defIdOf(card));
  const p = state.players[player];
  const turn = state.action?.turn;

  if (!p) return { ok: false, cost: 0, maxCards: 0, reason: 'notConstructible' };
  if (!isConstructible(def)) return { ok: false, cost: 0, maxCards: 0, reason: 'notConstructible' };
  if (turn && turn.buildsUsed >= turn.buildLimit) {
    return { ok: false, cost: 0, maxCards: 0, reason: 'limitReached' };
  }
  if (hasSameTitle(state, player, def) && !allowsDuplicate(state, player, def, ctx)) {
    return { ok: false, cost: 0, maxCards: 0, reason: 'duplicate' };
  }

  const cost = buildCost(state, player, def, ctx);
  const maxCards = Math.min(cardPaymentAllowance(state, player, def, ctx), cost);
  if (p.gold + maxCards < cost) return { ok: false, cost, maxCards, reason: 'tooExpensive' };
  return { ok: true, cost, maxCards };
}

/** 도시에 놓여 있는 건물들의 총 건설비용 (게임 종료 점수의 기본). */
export function cityCost(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  if (!p) return 0;
  return p.city.reduce((n, e) => {
    const def = defOf(e.card);
    return n + (def.cost ?? 0);
  }, 0);
}

export const isCityComplete = (state: GameState, player: PlayerId): boolean =>
  (state.players[player]?.city.length ?? 0) >= state.config.targetCitySize;
