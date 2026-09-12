import type { Choice, ChoiceOf, Prompt } from '@/engine/state/prompt';
import type { GameEvent } from '@/engine/state/event';
import type { PlayerView } from '@/engine/view';

/**
 * 결정을 답하는 주체. 봇도 사람도 여기에 꽂힌다.
 *
 * `decide` 가 Promise 인 유일한 이유는 **나중에 사람과 Web Worker 를 같은
 * 인터페이스로 받기 위해서**다. 봇은 내부가 완전 동기이고 Promise.resolve 로
 * 감싸질 뿐이다. 이음매만 지금 만들고 구현은 미룬다.
 */
export interface Agent {
  readonly name: string;
  decide<D extends Prompt>(view: PlayerView, decision: D): Promise<ChoiceOf<D>>;
  /** 매 전이 후 관측. 선택 사항. */
  observe?(events: readonly GameEvent[], view: PlayerView): void;
}

export type DecideFn = (view: PlayerView, decision: Prompt) => Choice;

/** 동기 결정 함수를 Agent 로 감싼다. */
export function syncAgent(name: string, decide: DecideFn): Agent {
  return {
    name,
    decide: <D extends Prompt>(view: PlayerView, d: D) =>
      Promise.resolve(decide(view, d) as ChoiceOf<D>),
  };
}
