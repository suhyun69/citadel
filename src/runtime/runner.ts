import type { Agent } from '@/bot/agent';
import { applyChoice, isOver, step } from '@/engine/machine';
import { assertInvariants } from '@/engine/rules/invariants';
import type { AnyChoice } from '@/engine/types/decision';
import type { PlayerId } from '@/engine/types/ids';
import type { GameState } from '@/engine/types/state';
import { viewFor } from '@/engine/view';

/** 봇 연출 딜레이를 주입으로 받는다. 엔진에는 setTimeout 이 들어가지 않는다. */
export interface Clock {
  delay(ms: number): Promise<void>;
}

export const instantClock: Clock = { delay: () => Promise.resolve() };
export const realClock: Clock = {
  delay: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export interface RunOptions {
  clock?: Clock;
  /** 결정 사이 딜레이(ms). 관전용. */
  stepDelayMs?: number;
  onState?: (state: GameState) => void;
  /** 매 전이마다 불변식 검사. 개발/테스트용. */
  verifyInvariants?: boolean;
  /** 무한 루프 방지. 정상 게임은 한참 못 미친다. */
  maxSteps?: number;
  /** 재현용 선택 로그를 여기에 쌓는다. */
  choiceLog?: AnyChoice[];
}

/**
 * 엔진과 에이전트를 잇는 유일한 비동기 지점.
 *
 * 나중에 사람이 들어와도 이 함수는 바뀌지 않는다 — `agents` 맵에 HumanAgent 를
 * 넣는 것이 전부다. 그것이 이 설계가 옳았는지의 판정 기준이다.
 */
export async function runMatch(
  init: GameState,
  agents: ReadonlyMap<PlayerId, Agent>,
  opts: RunOptions = {},
): Promise<GameState> {
  const clock = opts.clock ?? instantClock;
  const maxSteps = opts.maxSteps ?? 200_000;

  let state = init;
  let steps = 0;

  while (!isOver(state)) {
    if (++steps > maxSteps) {
      throw new Error(`${maxSteps}스텝을 넘겼습니다 — 진행이 막혔을 가능성이 큽니다 (seed=${state.config.seed})`);
    }

    if (state.pending) {
      const d = state.pending;
      const agent = agents.get(d.player);
      if (!agent) throw new Error(`P${d.player} 를 맡은 에이전트가 없습니다`);

      const choice = (await agent.decide(viewFor(state, d.player), d)) as AnyChoice;
      const withType = { ...choice, type: d.type } as AnyChoice;
      opts.choiceLog?.push(withType);
      state = applyChoice(state, withType);

      if (opts.stepDelayMs) await clock.delay(opts.stepDelayMs);
    } else {
      state = step(state);
    }

    if (opts.verifyInvariants) assertInvariants(state, `step ${steps}`);
    opts.onState?.(state);
  }

  return state;
}

/** 좌석마다 에이전트를 배정한다. */
export function seatAgents(agents: readonly Agent[]): ReadonlyMap<PlayerId, Agent> {
  const map = new Map<PlayerId, Agent>();
  agents.forEach((a, i) => map.set(i as PlayerId, a));
  return map;
}
