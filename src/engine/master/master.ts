import { presetDef } from '@/data/types';
import { advanceState } from '../flow/advance';
import { applyApprovedChoice } from '../flow/apply';
import { legalChoices } from '../options/enumerate';
import { ACCEPTED, approveChoice, type Approval } from '../options/approve';
import { createMatch, matchConfig, type MatchOptions } from '../setup';
import type { GameEvent } from '../state/event';
import type { GameState, MatchConfig, MatchResult, Phase } from '../state/game-state';
import { playerId, type PlayerId } from '../state/ids';
import type { Choice, Prompt } from '../state/prompt';
import { PlayerHandle } from './player';
import type { GameMaster, MasterAccess, Player } from './types';

/**
 * 게임 마스터 구현.
 *
 * 불변 상태 값을 가리키는 **커서**다. `advance()` 와 `submit()` 이 가리키는
 * 곳을 앞으로 옮길 뿐, 상태 값 자체는 절대 변형하지 않는다. 덕분에
 * `snapshot()` 은 언제 찍어도 그 순간이 통째로 보존된 값이다.
 */
class Master implements GameMaster, MasterAccess {
  #state: GameState;
  #history: Choice[] = [];
  readonly #players: readonly PlayerHandle[];

  constructor(initial: GameState) {
    this.#state = initial;
    this.#players = initial.players.map((_, i) => new PlayerHandle(this, playerId(i)));
  }

  // ── MasterAccess (핸들 전용) ────────────────────────────
  state(): GameState {
    return this.#state;
  }

  // ── 판 전체 ────────────────────────────────────────────
  snapshot(): GameState {
    return this.#state;
  }
  history(): readonly Choice[] {
    return this.#history;
  }
  round(): number {
    return this.#state.round;
  }
  phase(): Phase {
    return this.#state.phase;
  }
  isOver(): boolean {
    return this.#state.phase === 'finished';
  }
  result(): MatchResult | null {
    return this.#state.result;
  }
  deckCount(): number {
    return this.#state.deck.length;
  }
  log(): readonly GameEvent[] {
    return this.#state.log;
  }

  // ── 플레이어 ───────────────────────────────────────────
  players(): readonly Player[] {
    return this.#players;
  }
  player(id: PlayerId): Player {
    const p = this.#players[id];
    if (!p) throw new Error(`알 수 없는 플레이어: ${id}`);
    return p;
  }
  crownHolder(): Player {
    return this.player(this.#state.crowned);
  }
  calledRank(): number | null {
    return this.#state.action?.rankCursor ?? null;
  }

  // ── 진행 ───────────────────────────────────────────────
  awaiting(): Player | null {
    const pending = this.#state.pending;
    return pending ? this.player(pending.player) : null;
  }

  advance(): void {
    this.#state = advanceState(this.#state);
  }

  promptFor(id: PlayerId): Prompt | null {
    const pending = this.#state.pending;
    return pending && pending.player === id ? pending : null;
  }

  optionsFor(id: PlayerId): Choice[] | null {
    const prompt = this.promptFor(id);
    return prompt ? legalChoices(prompt) : null;
  }

  // ── 승인과 적용 ────────────────────────────────────────
  approve(id: PlayerId, choice: Choice): Approval {
    const prompt = this.promptFor(id);
    if (!prompt) {
      const waiting = this.#state.pending;
      return {
        ok: false,
        reason: waiting
          ? `지금은 P${waiting.player} 의 차례입니다`
          : '지금은 아무에게도 묻고 있지 않습니다',
      };
    }
    return approveChoice(this.#state, prompt, choice);
  }

  submit(id: PlayerId, choice: Choice): Approval {
    const verdict = this.approve(id, choice);
    if (!verdict.ok) return verdict;

    // approve 가 통과했으면 prompt 는 반드시 있다.
    const prompt = this.promptFor(id) as Prompt;
    this.#state = applyApprovedChoice(this.#state, prompt, choice);
    this.#history.push(choice);
    return ACCEPTED;
  }
}

/** 새 판을 시작한다. */
export function createGame(options: MatchOptions): GameMaster {
  return new Master(createMatch(matchConfig(options)));
}

/** 이미 만들어진 설정/상태로 시작한다. 리플레이와 테스트가 쓴다. */
export function gameFromConfig(config: MatchConfig): GameMaster {
  return new Master(createMatch(config));
}

/** 임의의 상태에서 이어간다. 미구현 카드 검사를 건너뛴다 — 테스트 전용. */
export function gameFromState(state: GameState): GameMaster {
  return new Master(state);
}

/** 프리셋 이름을 사람이 읽는 형태로. */
export const presetName = (config: MatchConfig): string => presetDef(config.presetId).name;
