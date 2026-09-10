import { applyChoice, isOver, step } from '@/engine/machine';
import { createMatchUnchecked } from '@/engine/setup';
import type { AnyChoice } from '@/engine/types/decision';
import type { GameState, MatchConfig } from '@/engine/types/state';

/**
 * 시드 + 선택 로그면 판이 그대로 되살아난다. 수백 바이트짜리 저장 포맷이고,
 * 봇 대전에서 버그를 만났을 때의 주 도구다.
 */
export interface Replay {
  config: MatchConfig;
  choices: AnyChoice[];
}

export function replay(r: Replay): GameState {
  let state = createMatchUnchecked(r.config);
  let i = 0;

  while (!isOver(state)) {
    if (state.pending) {
      const choice = r.choices[i++];
      if (!choice) throw new Error(`선택 로그가 부족합니다 (${i - 1}번째에서 끊김)`);
      state = applyChoice(state, choice);
    } else {
      state = step(state);
    }
  }

  if (i !== r.choices.length) {
    throw new Error(`선택 로그가 남았습니다: ${r.choices.length - i}개`);
  }
  return state;
}
