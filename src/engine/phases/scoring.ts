import { BUILDING_KINDS, characterDef, type BuildingKind } from '@/data/types';
import { makeScoreCtx } from '../effects/ctx';
import { collectHooks } from '../effects/registry';
import { cityCost } from '../rules/build';
import { defOf, playerId, type PlayerId } from '../types/ids';
import type { CityEntry, GameState, MatchResult, PlayerScore } from '../types/state';

export const ALL_KINDS_BONUS = 3;
export const FIRST_COMPLETE_BONUS = 4;
export const COMPLETE_BONUS = 2;

/**
 * 유령 지구를 어떤 종류로 쓸지. 규칙상 플레이어가 고르지만 숨은 정보가 없는
 * 순수 최대화 문제라 pending 을 하나 더 만들 가치가 없다.
 *
 * 다만 **최대화 대상은 최종 점수여야 한다** — 유령 지구를 특수 이외의 종류로
 * 쓰면 더 이상 특수 건물이 아니게 되어 소원의 우물 점수에서 빠지기 때문이다.
 * 그래서 후보를 전부 계산해 최댓값을 고른다.
 */
export type WildcardAs = BuildingKind | null;

/**
 * 게임 종료 시점에 이 건물이 어떤 종류로 세어지는가.
 *
 * ★ 수입 계산의 countIncome 과 별개다. 마법학교는 "자원을 받는 능력" 에만
 *   걸리고 여기엔 관여하지 않으며, 유령 지구는 반대로 여기에만 걸린다.
 *   둘을 한 메커니즘으로 합치면 마법학교가 5종 보너스를 채우거나
 *   유령 지구가 주교 수입을 늘리는 버그가 조용히 생긴다.
 */
export function scoringKindOf(
  state: GameState,
  player: PlayerId,
  entry: CityEntry,
  wildcardAs: WildcardAs,
): BuildingKind {
  const ctx = makeScoreCtx(state, player, wildcardAs);
  for (const h of collectHooks(state, player)) {
    const o = h.scoringKindOverride?.(entry, ctx);
    if (o === 'wildcard') return wildcardAs ?? defOf(entry.card).kind;
    if (o) return o;
  }
  return defOf(entry.card).kind;
}

function hasWildcard(state: GameState, player: PlayerId): boolean {
  const p = state.players[player];
  if (!p) return false;
  const ctx = makeScoreCtx(state, player, null);
  const hooks = collectHooks(state, player);
  return p.city.some((entry) => hooks.some((h) => h.scoringKindOverride?.(entry, ctx) === 'wildcard'));
}

function scoreWith(state: GameState, player: PlayerId, wildcardAs: WildcardAs): PlayerScore {
  const p = state.players[player];
  const buildingCost = cityCost(state, player);

  const present = new Set<BuildingKind>();
  for (const entry of p?.city ?? []) present.add(scoringKindOf(state, player, entry, wildcardAs));
  const allKindsBonus = BUILDING_KINDS.every((k) => present.has(k)) ? ALL_KINDS_BONUS : 0;

  let completionBonus = 0;
  if (p && p.cityCompletedAtRound !== null) {
    completionBonus = state.firstCompleted === player ? FIRST_COMPLETE_BONUS : COMPLETE_BONUS;
  }

  const ctx = makeScoreCtx(state, player, wildcardAs);
  let uniqueBonus = 0;
  for (const h of collectHooks(state, player)) {
    if (h.endGameScore) uniqueBonus += h.endGameScore(ctx);
  }

  return {
    player,
    buildingCost,
    allKindsBonus,
    completionBonus,
    uniqueBonus,
    total: buildingCost + allKindsBonus + completionBonus + uniqueBonus,
  };
}

export function scoreFor(state: GameState, player: PlayerId): PlayerScore {
  if (!hasWildcard(state, player)) return scoreWith(state, player, null);

  let best = scoreWith(state, player, null);
  for (const kind of BUILDING_KINDS) {
    const candidate = scoreWith(state, player, kind);
    if (candidate.total > best.total) best = candidate;
  }
  return best;
}

/** 동점이면 마지막 라운드의 캐릭터 순번이 더 늦은 쪽이 이긴다 (howto.md:120). */
function lastRank(state: GameState, player: PlayerId): number {
  const c = state.players[player]?.character;
  return c ? characterDef(c.characterId).rank : 0;
}

export function computeResult(state: GameState): MatchResult {
  const scores = state.players.map((_, i) => scoreFor(state, playerId(i)));

  const winner = scores.reduce((best, s) => {
    if (s.total !== best.total) return s.total > best.total ? s : best;
    return lastRank(state, s.player) > lastRank(state, best.player) ? s : best;
  }, scores[0] as PlayerScore);

  return { scores, winner: winner.player };
}

export function finishScoring(state: GameState): void {
  const result = computeResult(state);
  state.result = result;
  state.phase = 'finished';
  state.log.push({ t: 'gameOver', winner: result.winner });
}
