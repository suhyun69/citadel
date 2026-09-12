import { gameFromConfig } from '@/engine/master/master';
import type { GameMaster } from '@/engine/master/types';
import type { MatchConfig } from '@/engine/state/game-state';
import type { Choice } from '@/engine/state/prompt';

/**
 * 시드 + 제출된 답들이면 판이 그대로 되살아난다.
 *
 * 수백 바이트짜리 저장 포맷이고, 봇 대전에서 버그를 만났을 때의 주 도구다.
 * 게임 마스터가 답을 다시 승인하며 진행하므로, 로그가 규칙에 어긋나면
 * 그 자리에서 드러난다.
 */
export interface Replay {
  config: MatchConfig;
  choices: readonly Choice[];
}

export function replay(r: Replay): GameMaster {
  const master = gameFromConfig(r.config);
  let i = 0;

  while (!master.isOver()) {
    const player = master.awaiting();
    if (!player) {
      master.advance();
      continue;
    }

    const choice = r.choices[i++];
    if (!choice) throw new Error(`선택 로그가 부족합니다 (${i - 1}번째에서 끊김)`);

    const verdict = player.submit(choice);
    if (!verdict.ok) {
      throw new Error(`${i - 1}번째 선택이 거절되었습니다: ${verdict.reason}`);
    }
  }

  if (i !== r.choices.length) {
    throw new Error(`선택 로그가 남았습니다: ${r.choices.length - i}개`);
  }
  return master;
}
