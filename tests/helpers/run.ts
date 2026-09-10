import { RandomAgent } from '@/bot/random';
import { createMatchUnchecked, matchConfig } from '@/engine/setup';
import type { AnyChoice } from '@/engine/types/decision';
import type { GameState } from '@/engine/types/state';
import { runMatch, seatAgents } from '@/runtime/runner';
import type { PresetId } from '@/data/types';

export interface PlayOptions {
  seed: number;
  playerCount: number;
  presetId?: PresetId;
  verifyInvariants?: boolean;
  choiceLog?: AnyChoice[];
}

/** 랜덤봇만으로 한 판 끝까지 돌린다. */
export async function playRandomGame(opts: PlayOptions): Promise<GameState> {
  const config = matchConfig({
    seed: opts.seed,
    playerCount: opts.playerCount,
    ...(opts.presetId ? { presetId: opts.presetId } : {}),
  });
  const agents = seatAgents(
    Array.from({ length: opts.playerCount }, (_, n) => new RandomAgent(`bot${n}`, opts.seed * 100 + n)),
  );
  return runMatch(createMatchUnchecked(config), agents, {
    verifyInvariants: opts.verifyInvariants ?? true,
    ...(opts.choiceLog ? { choiceLog: opts.choiceLog } : {}),
  });
}

/** 로그를 뺀 최종 상태 지문. 결정론 비교에 쓴다. */
export function fingerprint(state: GameState): string {
  const { log: _log, ...rest } = state;
  return JSON.stringify(rest);
}
