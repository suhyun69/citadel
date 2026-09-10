import type { CharacterId } from '@/data/types';
import type { GameEvent } from './types/event';
import { playerId, type CardId, type PlayerId } from './types/ids';
import type { CharacterSlot, CityEntry, GameState, MatchConfig } from './types/state';

/**
 * 한 플레이어가 볼 수 있는 것만 남긴 상태.
 *
 * 봇에게 GameState 를 그대로 주면 상대 손패를 보고 짜여지고, 나중에 사람이
 * 들어오는 순간 "봇은 알지만 사람은 모르는 정보" 가 드러나며 봇을 다시 짜야
 * 한다. 봇 전용 단계라도 처음부터 이 뷰만 준다.
 */
export interface PlayerView {
  me: {
    id: PlayerId;
    gold: number;
    hand: readonly CardId[];
    city: readonly CityEntry[];
    character: CharacterSlot | null;
  };
  opponents: readonly {
    id: PlayerId;
    gold: number;
    handCount: number;
    city: readonly CityEntry[];
    /** 호명되어 공개된 캐릭터만. 아직 안 밝혀졌으면 null. */
    revealedCharacter: CharacterId | null;
  }[];
  round: number;
  crowned: PlayerId;
  deckCount: number;
  /** 앞면으로 버려진 캐릭터 — 이번 라운드에 없다는 것이 공개 정보다. */
  faceUpDiscards: readonly CharacterId[];
  /** 뒷면 버림은 장수만 안다. */
  faceDownCount: number;
  charactersInGame: readonly CharacterId[];
  calledRank: number | null;
  targetCitySize: number;
  playerCount: number;
  log: readonly GameEvent[];
  config: MatchConfig;
}

export function viewFor(state: GameState, viewer: PlayerId): PlayerView {
  const me = state.players[viewer];
  if (!me) throw new Error(`알 수 없는 플레이어: ${viewer}`);

  const opponents = state.players
    .filter((p) => p.id !== viewer)
    .map((p) => ({
      id: p.id,
      gold: p.gold,
      handCount: p.hand.length,
      city: p.city,
      revealedCharacter: p.character?.revealed ? p.character.characterId : null,
    }));

  return {
    me: { id: me.id, gold: me.gold, hand: me.hand, city: me.city, character: me.character },
    opponents,
    round: state.round,
    crowned: state.crowned,
    deckCount: state.deck.length,
    faceUpDiscards: state.selection?.faceUp ?? [],
    faceDownCount: state.selection?.faceDown.length ?? 0,
    charactersInGame: state.config.characterIds,
    calledRank: state.action?.rankCursor ?? null,
    targetCitySize: state.config.targetCitySize,
    playerCount: state.config.playerCount,
    log: state.log.map((e) => redactEvent(e, viewer)).filter((e): e is GameEvent => e !== null),
    config: state.config,
  };
}

/** 남이 무엇을 골랐는지는 공개되기 전까지 숨긴다. */
export function redactEvent(e: GameEvent, viewer: PlayerId): GameEvent | null {
  if (e.t === 'characterPicked' && e.player !== viewer) return null;
  return e;
}

export const allPlayers = (state: GameState): PlayerId[] =>
  state.players.map((_, i) => playerId(i));
