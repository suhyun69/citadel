import { ALL_BUILDINGS, buildingDef, characterDef, presetDef, type PresetId } from '@/data/types';
import { missingCards } from './effects/registry';
import { seedRng, shuffle } from './rng';
import { MAX_PLAYERS, MIN_PLAYERS, discardCounts } from './rules/selection-table';
import { cardId, playerId, type CardId, type PlayerId } from './types/ids';
import type { GameState, MatchConfig, PlayerState } from './types/state';

export const STARTING_HAND = 4;
export const STARTING_GOLD = 2;
export const DEFAULT_TARGET_CITY_SIZE = 7;
export const DEFAULT_MAX_ROUNDS = 40;

export interface MatchOptions {
  seed: number;
  playerCount: number;
  presetId?: PresetId;
  targetCitySize?: number;
  maxRounds?: number;
}

export function matchConfig(opts: MatchOptions): MatchConfig {
  const presetId = opts.presetId ?? ('basic' as PresetId);
  const preset = presetDef(presetId);

  if (opts.playerCount < MIN_PLAYERS || opts.playerCount > MAX_PLAYERS) {
    throw new Error(`플레이어 수는 ${MIN_PLAYERS}~${MAX_PLAYERS}명이어야 합니다 (받은 값: ${opts.playerCount})`);
  }
  discardCounts(opts.playerCount); // 지원하지 않는 인원수면 여기서 던진다

  const characterIds = [...preset.characters].sort(
    (a, b) => characterDef(a).rank - characterDef(b).rank,
  );

  return {
    seed: opts.seed,
    playerCount: opts.playerCount,
    presetId,
    characterIds,
    uniqueBuildingIds: preset.uniques,
    targetCitySize: opts.targetCitySize ?? DEFAULT_TARGET_CITY_SIZE,
    maxRounds: opts.maxRounds ?? DEFAULT_MAX_ROUNDS,
  };
}

/** 기본 건물 54장 전부 + 프리셋이 고른 특수 건물. 기본 조합이면 68장. */
export function buildDeck(config: MatchConfig): CardId[] {
  const cards: CardId[] = [];

  for (const def of ALL_BUILDINGS) {
    if (def.kind === 'unique') continue;
    for (let copy = 1; copy <= def.copies; copy++) cards.push(cardId(def.id, copy));
  }
  for (const id of config.uniqueBuildingIds) {
    const def = buildingDef(id);
    for (let copy = 1; copy <= def.copies; copy++) cards.push(cardId(def.id, copy));
  }
  return cards;
}

export function createMatch(config: MatchConfig): GameState {
  const preset = presetDef(config.presetId);
  const missing = missingCards(preset);
  if (missing.characters.length || missing.uniques.length) {
    const parts: string[] = [];
    if (missing.characters.length) {
      parts.push(`캐릭터 ${missing.characters.map((c) => characterDef(c).name).join(', ')}`);
    }
    if (missing.uniques.length) {
      parts.push(`특수 건물 ${missing.uniques.map((u) => buildingDef(u).title).join(', ')}`);
    }
    throw new Error(
      `프리셋 "${preset.name}" 은 아직 플레이할 수 없습니다. 효과가 구현되지 않은 카드: ${parts.join(' / ')}`,
    );
  }
  return createMatchUnchecked(config);
}

/**
 * 미구현 카드 검사를 건너뛴다. M1 처럼 능력이 전부 stub 인 단계에서
 * 골격만 돌려보기 위한 통로이며, 테스트와 시뮬레이터에서만 쓴다.
 */
export function createMatchUnchecked(config: MatchConfig): GameState {
  const [deck, rng] = shuffle(seedRng(config.seed), buildDeck(config));

  const players: PlayerState[] = [];
  for (let i = 0; i < config.playerCount; i++) {
    players.push({
      id: playerId(i),
      gold: STARTING_GOLD,
      hand: deck.splice(0, STARTING_HAND),
      city: [],
      character: null,
      cityCompletedAtRound: null,
    });
  }

  return {
    config,
    rng,
    round: 0,
    phase: 'selection',
    crowned: playerId(0),
    players,
    deck,
    selection: null,
    action: null,
    pending: null,
    log: [],
    firstCompleted: null,
    result: null,
  };
}

/** 왕관 주인부터 시계 방향 좌석 순서. */
export function seatOrder(crowned: PlayerId, playerCount: number): PlayerId[] {
  return Array.from({ length: playerCount }, (_, i) => playerId((crowned + i) % playerCount));
}
