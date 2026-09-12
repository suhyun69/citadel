import { RandomAgent } from '@/bot/random';
import { createGame, type GameMaster } from '@/engine';
import type { GameState } from '@/engine/state/game-state';
import { runMatch, seatAgents } from '@/runtime/runner';
import type { PresetId } from '@/data/types';

export interface PlayOptions {
  seed: number;
  playerCount: number;
  presetId?: PresetId;
  verifyInvariants?: boolean;
}

/** 랜덤봇만으로 한 판 끝까지 돌린다. */
export async function playRandomGame(opts: PlayOptions): Promise<GameMaster> {
  const agents = seatAgents(
    Array.from(
      { length: opts.playerCount },
      (_, n) => new RandomAgent(`bot${n}`, opts.seed * 100 + n),
    ),
  );
  const master = createGame({
    seed: opts.seed,
    playerCount: opts.playerCount,
    ...(opts.presetId ? { presetId: opts.presetId } : {}),
  });
  return runMatch(master, agents, { verifyInvariants: opts.verifyInvariants ?? true });
}

/** 로그를 뺀 최종 상태 지문. 결정론 비교에 쓴다. */
export function fingerprint(state: GameState): string {
  const { log: _log, ...rest } = state;
  return JSON.stringify(rest);
}
