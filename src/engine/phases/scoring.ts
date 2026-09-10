import { BUILDING_KINDS, characterDef, type BuildingKind } from '@/data/types';
import { makeScoreCtx } from '../effects/ctx';
import { collectHooks } from '../effects/registry';
import { cityCost } from '../rules/build';
import { defOf, playerId, type PlayerId } from '../types/ids';
import type { GameState, MatchResult, PlayerScore } from '../types/state';

export const ALL_KINDS_BONUS = 3;
export const FIRST_COMPLETE_BONUS = 4;
export const COMPLETE_BONUS = 2;

/**
 * 유령 지구의 "원하는 종류" 결정.
 *
 * 규칙상 플레이어가 고르지만 숨은 정보가 없는 순수 최대화 문제라 pending 을
 * 하나 더 만들 가치가 없다. 다만 **최대화 대상은 최종 점수여야 한다** —
 * 유령 지구를 특수 이외의 종류로 쓰면 더 이상 특수 건물이 아니게 되어
 * 소원의 우물 점수에서 빠지기 때문이다(howto.md 건물 상세 설명).
 * 그래서 후보를 전부 계산해 최댓값을 고른다.
 */
export type WildcardAs = BuildingKind | null;

function wildcardEntries(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  if (!p) return 0;
  const ctx = makeScoreCtx(state, player);
  const hooks = collectHooks(state, player);
  let n = 0;
  for (const entry of p.city) {
    for (const h of hooks) {
      if (h.scoringKindOverride?.(entry, ctx) === 'wildcard') {
        n += 1;
        break;
      }
    }
  }
  return n;
}

function kindsPresent(state: GameState, player: PlayerId, wildcardAs: WildcardAs): Set<BuildingKind> {
  const p = state.players[player];
  const present = new Set<BuildingKind>();
  if (!p) return present;

  const ctx = makeScoreCtx(state, player);
  const hooks = collectHooks(state, player);

  for (const entry of p.city) {
    let kind: BuildingKind | 'wildcard' | null = null;
    for (const h of hooks) {
      const o = h.scoringKindOverride?.(entry, ctx);
      if (o) {
        kind = o;
        break;
      }
    }
    if (kind === 'wildcard') {
      if (wildcardAs) present.add(wildcardAs);
      else present.add(defOf(entry.card).kind);
    } else {
      present.add(kind ?? defOf(entry.card).kind);
    }
  }
  return present;
}

function scoreWith(state: GameState, player: PlayerId, wildcardAs: WildcardAs): PlayerScore {
  const p = state.players[player];
  const buildingCost = cityCost(state, player);

  const present = kindsPresent(state, player, wildcardAs);
  const allKindsBonus = BUILDING_KINDS.every((k) => present.has(k)) ? ALL_KINDS_BONUS : 0;

  let completionBonus = 0;
  if (p?.cityCompletedAtRound !== null && p !== undefined) {
    completionBonus = state.firstCompleted === player ? FIRST_COMPLETE_BONUS : COMPLETE_BONUS;
  }

  const ctx = makeScoreCtx(state, player);
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
  if (wildcardEntries(state, player) === 0) return scoreWith(state, player, null);

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
