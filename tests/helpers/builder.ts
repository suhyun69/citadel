import { characterDef, type CharacterId } from '@/data/types';
import { buildLimitFor } from '@/engine/flow/turn';
import { buildDeck, createMatchUnchecked, matchConfig } from '@/engine/setup';
import { playerId, type CardId, type PlayerId } from '@/engine/state/ids';
import type { GameState, TurnStage } from '@/engine/state/game-state';

export interface PlayerSpec {
  gold?: number;
  hand?: string[];
  city?: string[];
  killed?: boolean;
  revealed?: boolean;
}

/**
 * 능력별 단위 테스트를 위한 상태 조립기.
 *
 * 카드 총량 보존을 깨지 않는 것이 중요하다 — 지정한 카드를 덱에서 빼서
 * 손패·도시로 옮기므로, 조립 결과도 불변식을 통과한다.
 */
export class GameBuilder {
  #seed = 0;
  #playerCount = 4;
  #crowned: PlayerId = playerId(0);
  #specs = new Map<number, PlayerSpec>();
  #characters = new Map<number, CharacterId>();
  #turn: { player: PlayerId; stage: TurnStage } | null = null;
  #rank: number | null = null;

  seed(n: number): this {
    this.#seed = n;
    return this;
  }
  players(n: number): this {
    this.#playerCount = n;
    return this;
  }
  crown(p: number): this {
    this.#crowned = playerId(p);
    return this;
  }
  player(p: number, spec: PlayerSpec): this {
    this.#specs.set(p, { ...this.#specs.get(p), ...spec });
    return this;
  }
  assign(p: number, character: CharacterId): this {
    this.#characters.set(p, character);
    return this;
  }
  /** 이 플레이어의 차례로 만든다. rankCursor 도 해당 캐릭터 순번에 맞춘다. */
  atTurn(p: number, stage: TurnStage = 'main'): this {
    this.#turn = { player: playerId(p), stage };
    return this;
  }
  /** 차례 없이 특정 순번을 호명하기 직전 상태로 만든다. */
  atRank(rank: number): this {
    this.#rank = rank;
    return this;
  }

  build(): GameState {
    const config = matchConfig({ seed: this.#seed, playerCount: this.#playerCount });
    const state = createMatchUnchecked(config);

    const used = new Set<string>();
    const take = (cards: string[] | undefined): CardId[] => {
      if (!cards) return [];
      for (const c of cards) {
        if (used.has(c)) throw new Error(`같은 카드를 두 번 배치했습니다: ${c}`);
        used.add(c);
      }
      return cards as CardId[];
    };

    for (let i = 0; i < this.#playerCount; i++) {
      const spec = this.#specs.get(i) ?? {};
      const p = state.players[i]!;
      p.gold = spec.gold ?? 2;
      p.hand = take(spec.hand);
      p.city = take(spec.city).map((card) => ({ card }));
      p.cityCompletedAtRound = p.city.length >= config.targetCitySize ? 1 : null;

      const character = this.#characters.get(i);
      p.character = character
        ? {
            characterId: character,
            revealed: spec.revealed ?? this.#turn?.player === i,
            killed: spec.killed ?? false,
            turnDone: false,
          }
        : null;
    }

    // 배치하지 않은 카드가 곧 더미다. 카드 총량 보존을 지킨다.
    state.deck = buildDeck(config).filter((c) => !used.has(c));
    state.round = 1;

    const first = [...this.#characters.values()][0];
    const turnRank = this.#turn
      ? characterDef(this.#characters.get(this.#turn.player) ?? (first as CharacterId)).rank
      : (this.#rank ?? 1);

    state.phase = 'action';
    state.crowned = this.#crowned;
    state.selection = null;
    state.action = {
      rankCursor: turnRank,
      turn: null,
      declared: { assassinTarget: null, thiefTarget: null },
    };

    if (this.#turn) {
      const character = this.#characters.get(this.#turn.player);
      if (!character) throw new Error(`P${this.#turn.player} 에게 캐릭터를 배정하지 않았습니다`);
      state.action.turn = {
        playerId: this.#turn.player,
        characterId: character,
        stage: this.#turn.stage,
        buildsUsed: 0,
        buildLimit: buildLimitFor(state, this.#turn.player),
        drawn: null,
        usedAbilities: [],
      };
    }

    return state;
  }
}

export const aGame = (): GameBuilder => new GameBuilder();

/** 카드 이름으로 찾기 편하게. `card('temple', 1)` → 'temple#1' */
export const card = (def: string, copy = 1): CardId => `${def}#${copy}` as CardId;
