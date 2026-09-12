import type { Agent } from '@/bot/agent';
import type { GameMaster } from '@/engine/master/types';
import { assertInvariants } from '@/engine/rules/invariants';
import type { PlayerId } from '@/engine/state/ids';
import type { Choice } from '@/engine/state/prompt';

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
  onProgress?: (master: GameMaster) => void;
  /** 매 전이마다 불변식 검사. 개발/테스트용. */
  verifyInvariants?: boolean;
  /** 무한 루프 방지. 정상 게임은 한참 못 미친다. */
  maxSteps?: number;
}

/**
 * 게임 마스터에게 묻고, 봇이 고르고, 마스터가 승인해 적용한다.
 *
 * 이 루프가 엔진과 에이전트를 잇는 유일한 비동기 지점이다. 나중에 사람이
 * 들어와도 바뀌지 않는다 — `agents` 맵에 사람용 에이전트를 넣는 것이 전부다.
 */
export async function runMatch(
  master: GameMaster,
  agents: ReadonlyMap<PlayerId, Agent>,
  opts: RunOptions = {},
): Promise<GameMaster> {
  const clock = opts.clock ?? instantClock;
  const maxSteps = opts.maxSteps ?? 200_000;
  let steps = 0;

  while (!master.isOver()) {
    if (++steps > maxSteps) {
      throw new Error(
        `${maxSteps}스텝을 넘겼습니다 — 진행이 막혔을 가능성이 큽니다 ` +
          `(seed=${master.snapshot().config.seed})`,
      );
    }

    const player = master.awaiting();
    if (!player) {
      master.advance();
    } else {
      const prompt = player.prompt();
      if (!prompt) throw new Error(`P${player.id} 가 기다린다는데 질문이 없습니다`);

      const agent = agents.get(player.id);
      if (!agent) throw new Error(`P${player.id} 를 맡은 에이전트가 없습니다`);

      const answer = (await agent.decide(player.view(), prompt)) as Choice;
      const verdict = player.submit({ ...answer, type: prompt.type } as Choice);
      if (!verdict.ok) {
        throw new Error(`P${player.id} 의 답이 거절되었습니다: ${verdict.reason}`);
      }

      if (opts.stepDelayMs) await clock.delay(opts.stepDelayMs);
    }

    if (opts.verifyInvariants) assertInvariants(master.snapshot(), `step ${steps}`);
    opts.onProgress?.(master);
  }

  return master;
}

/** 좌석마다 에이전트를 배정한다. */
export function seatAgents(agents: readonly Agent[]): ReadonlyMap<PlayerId, Agent> {
  const map = new Map<PlayerId, Agent>();
  agents.forEach((a, i) => map.set(i as PlayerId, a));
  return map;
}
