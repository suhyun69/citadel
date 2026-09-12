import type { Agent } from '@/bot/agent';
import { HeuristicAgent, POLICIES } from '@/bot/heuristic';
import { RandomAgent } from '@/bot/random';
import { createMatch, matchConfig } from '@/engine/setup';
import { playerId, type PlayerId } from '@/engine/state/ids';
import type { GameState } from '@/engine/state/game-state';
import { runMatch } from '@/runtime/runner';
import { Aborted, Pacer } from './pacer';

export interface MatchSetup {
  seed: number;
  playerCount: number;
  botKind: string;
}

export interface Snapshot {
  state: GameState;
  setup: MatchSetup;
  paused: boolean;
  speedMs: number;
  running: boolean;
}

const DEFAULT_SETUP: MatchSetup = { seed: 0, playerCount: 4, botKind: 'normal' };

/** 알림 간격. 60fps 보다 촘촘히 그릴 이유가 없다. */
const NOTIFY_INTERVAL_MS = 16;

function makeAgent(kind: string, name: string, seed: number): Agent {
  if (kind === 'random') return new RandomAgent(name, seed);
  const policy = POLICIES[kind] ?? POLICIES['normal'];
  return new HeuristicAgent(name, seed, policy);
}

/**
 * React 밖에 사는 스토어.
 *
 * 엔진 루프는 렌더 사이클과 무관하게 돌아야 하고, GameState 는 매 전이마다
 * 통째로 새로 만들어지므로 리렌더를 한 곳에서 통제하는 편이 낫다.
 * useSyncExternalStore 로 붙인다.
 */
export class MatchController {
  #snapshot: Snapshot;
  #listeners = new Set<() => void>();
  #pacer = new Pacer();
  #generation = 0;
  #dirty = false;
  #lastNotify = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(setup: MatchSetup = DEFAULT_SETUP) {
    this.#snapshot = {
      state: createMatch(matchConfig(setup)),
      setup,
      paused: false,
      speedMs: this.#pacer.speedMs,
      running: false,
    };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  };

  getSnapshot = (): Snapshot => this.#snapshot;

  /**
   * 상태는 바로 갱신하되 **알림은 최대 60fps 로 합친다.**
   *
   * runMatch 는 결정 하나 사이에도 여러 번 전이한다(순번 호명, 스킵, 라운드
   * 정산…). 전이마다 리렌더하면 화면이 따라오지 못해 "즉시" 속도가 오히려
   * 가장 느려진다.
   *
   * requestAnimationFrame 을 쓰지 않는 이유: 탭이 백그라운드로 가면 rAF 가
   * 아예 멈춰 화면이 영원히 갱신되지 않는다. 시간 기준 스로틀은 어디서든 돈다.
   */
  #emit(patch: Partial<Snapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    this.#dirty = true;

    if (Date.now() - this.#lastNotify >= NOTIFY_INTERVAL_MS) {
      this.#flush();
      return;
    }
    if (this.#timer !== null) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#flush();
    }, NOTIFY_INTERVAL_MS);
  }

  /** 대기 중인 알림을 즉시 내보낸다. */
  #flush(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    this.#lastNotify = Date.now();
    for (const fn of this.#listeners) fn();
  }

  /** 새 판을 시작한다. 진행 중이던 판은 버린다. */
  start(setup: Partial<MatchSetup> = {}): void {
    const next = { ...this.#snapshot.setup, ...setup };
    this.#generation += 1;
    const generation = this.#generation;

    this.#pacer.abort();
    this.#pacer = new Pacer();
    this.#pacer.speedMs = this.#snapshot.speedMs;

    const initial = createMatch(matchConfig(next));
    this.#emit({ state: initial, setup: next, running: true, paused: false });

    const agents = new Map<PlayerId, Agent>();
    for (let i = 0; i < next.playerCount; i++) {
      agents.set(playerId(i), makeAgent(next.botKind, `${next.botKind}${i}`, next.seed * 100 + i));
    }

    void runMatch(initial, agents, {
      clock: this.#pacer,
      stepDelayMs: 1, // 실제 대기 길이는 Pacer 가 정한다
      onState: (state) => {
        if (generation !== this.#generation) throw new Aborted();
        this.#emit({ state });
      },
    })
      .then(() => {
        if (generation === this.#generation) {
          this.#emit({ running: false });
          this.#flush();
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Aborted) return;
        if (generation === this.#generation) {
          this.#emit({ running: false });
          console.error(err);
        }
      });
  }

  play(): void {
    this.#pacer.play();
    this.#emit({ paused: false });
  }

  pause(): void {
    this.#pacer.pause();
    this.#emit({ paused: true });
  }

  toggle(): void {
    if (this.#snapshot.paused) this.play();
    else this.pause();
  }

  /** 일시정지 상태에서 결정 하나만 진행. */
  stepOnce(): void {
    if (!this.#snapshot.paused) this.pause();
    this.#pacer.stepOnce();
  }

  setSpeed(ms: number): void {
    this.#pacer.speedMs = ms;
    this.#emit({ speedMs: ms });
  }
}
