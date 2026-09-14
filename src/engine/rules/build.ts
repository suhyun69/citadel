import { buildingDef, isConstructible, type BuildingDef } from '@/data/types';
import { BUILDING_EFFECTS, collectHooks } from '../effects/registry';
import { makeCtx } from '../effects/ctx';
import type { EffectCtx, GameHooks } from '../effects/hooks';
import { defIdOf, defOf, type CardId, type PlayerId } from '../state/ids';
import type { CityEntry, GameState } from '../state/game-state';

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

/**
 * 이 건설이 **건설 횟수에 포함되지 않는가**.
 *
 * 교역상(상업 건물)은 도시 밖에서 오지만, 마구간은 자기 자신을 지을 때
 * 작동하므로 그때 아직 손에 있다 — 그래서 짓는 카드의 정의에서도 훅을 꺼낸다.
 */
export function isBuildFree(
  state: GameState,
  player: PlayerId,
  def: BuildingDef,
  ctx: EffectCtx,
): boolean {
  const own = (BUILDING_EFFECTS as Record<string, GameHooks | undefined>)[def.id];
  if (own?.isBuildFree?.(def, ctx)) return true;
  return collectHooks(state, player).some((h) => h.isBuildFree?.(def, ctx) === true);
}

/**
 * 이 카드가 스스로 내건 건설 조건을 통과하는가 (기념물).
 *
 * 마구간·도적 소굴과 같은 이유로 **짓는 카드 자신의 정의**에서 훅을 꺼낸다 —
 * 아직 손에 있어 도시 기준의 collectHooks 에는 잡히지 않는다.
 */
export function passesOwnBuildRule(
  _state: GameState,
  _player: PlayerId,
  def: BuildingDef,
  ctx: EffectCtx,
): boolean {
  const own = (BUILDING_EFFECTS as Record<string, GameHooks | undefined>)[def.id];
  return own?.canBeBuilt?.(def, ctx) ?? true;
}

/** 공동묘지처럼 자기 건물 1채를 부숴 건설비용을 대신할 수 있는가. */
export function sacrificeOptions(
  state: GameState,
  player: PlayerId,
  def: BuildingDef,
  ctx: EffectCtx,
): CardId[] {
  const own = (BUILDING_EFFECTS as Record<string, GameHooks | undefined>)[def.id];
  if (!own?.canSacrificeToBuild?.(def, ctx)) return [];
  return (state.players[player]?.city ?? []).map((e) => e.card);
}

export interface BuildCheck {
  ok: boolean;
  cost: number;
  /** 0 보다 크면 건설 시 지불 방식을 물어야 한다. */
  maxCards: number;
  reason?: 'notConstructible' | 'duplicate' | 'tooExpensive' | 'limitReached' | 'ownRule';
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
  // 건설 횟수에 포함되지 않는 건물은 한도에 걸리지 않는다.
  if (turn && turn.buildsUsed >= turn.buildLimit && !isBuildFree(state, player, def, ctx)) {
    return { ok: false, cost: 0, maxCards: 0, reason: 'limitReached' };
  }
  if (hasSameTitle(state, player, def) && !allowsDuplicate(state, player, def, ctx)) {
    return { ok: false, cost: 0, maxCards: 0, reason: 'duplicate' };
  }
  if (!passesOwnBuildRule(state, player, def, ctx)) {
    return { ok: false, cost: 0, maxCards: 0, reason: 'ownRule' };
  }

  const cost = buildCost(state, player, def, ctx);
  const maxCards = Math.min(cardPaymentAllowance(state, player, def, ctx), cost);
  const canSacrifice = sacrificeOptions(state, player, def, ctx).length > 0;

  if (!canSacrifice && p.gold + maxCards < cost) {
    return { ok: false, cost, maxCards, reason: 'tooExpensive' };
  }
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

/**
 * 도시 완성 판정에 쓰는 건물 수.
 *
 * 보통은 도시에 놓인 카드 수 그대로지만, 기념물은 혼자 2채로 세어진다
 * (howto.md 기념물). 점수의 건설비용 합과는 무관하다 — 그쪽은 카드 한 장의
 * 값을 한 번만 더한다.
 */
export function citySize(
  state: GameState,
  player: PlayerId,
  skip?: (entry: CityEntry) => boolean,
): number {
  const p = state.players[player];
  if (!p) return 0;
  const ctx = makeCtx(state, player);
  const hooks = collectHooks(state, player);

  return p.city.reduce((n, entry) => {
    if (skip?.(entry)) return n;
    for (const h of hooks) {
      const w = h.citySizeWeight?.(entry, ctx);
      if (w !== undefined) return n + w;
    }
    return n + 1;
  }, 0);
}

/**
 * 도시가 완성되었는가.
 *
 * `skip` 은 **아직 일어나지 않은 제거를 미리 반영**할 때 쓴다 — 병기고는
 * 자신을 부수면서 능력을 쓰므로, 목표를 고르는 시점의 도시에는 이미 병기고가
 * 없다.
 */
export const isCityComplete = (
  state: GameState,
  player: PlayerId,
  skip?: (entry: CityEntry) => boolean,
): boolean => citySize(state, player, skip) >= state.config.targetCitySize;
