import { buildingDef, isConstructible, type BuildingDef } from '@/data/types';
import { collectHooks } from '../effects/registry';
import type { EffectCtx } from '../effects/hooks';
import { defIdOf, defOf, type CardId, type PlayerId } from '../types/ids';
import type { GameState } from '../types/state';

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

export interface BuildCheck {
  ok: boolean;
  cost: number;
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

  if (!p) return { ok: false, cost: 0, reason: 'notConstructible' };
  if (!isConstructible(def)) return { ok: false, cost: 0, reason: 'notConstructible' };
  if (turn && turn.buildsUsed >= turn.buildLimit) {
    return { ok: false, cost: 0, reason: 'limitReached' };
  }
  if (hasSameTitle(state, player, def) && !allowsDuplicate(state, player, def, ctx)) {
    return { ok: false, cost: 0, reason: 'duplicate' };
  }

  const cost = buildCost(state, player, def, ctx);
  if (p.gold < cost) return { ok: false, cost, reason: 'tooExpensive' };
  return { ok: true, cost };
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
