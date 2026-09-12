import type { Agent } from '@/bot/agent';
import { HeuristicAgent, POLICIES } from '@/bot/heuristic';
import { RandomAgent } from '@/bot/random';
import { createMatch, matchConfig } from '@/engine/setup';
import { playerId } from '@/engine/state/ids';
import { runMatch } from '@/runtime/runner';

function makeAgent(kind: string, seed: number): Agent {
  if (kind === 'random') return new RandomAgent(kind, seed);
  const policy = POLICIES[kind];
  if (!policy) throw new Error(`알 수 없는 봇 종류: ${kind}`);
  return new HeuristicAgent(kind, seed, policy);
}

export interface ArenaResult {
  games: number;
  aWins: number;
  winRate: number;
}

/**
 * A 봇 1명 + B 봇 나머지로 붙인다. **좌석을 매판 돌린다** — 왕관이 좌석 0에서
 * 시작하므로 좌석을 고정하면 선수 이점이 승률에 섞인다.
 */
export async function arena(
  a: string,
  b: string,
  games: number,
  playerCount = 4,
): Promise<ArenaResult> {
  let aWins = 0;

  for (let g = 0; g < games; g++) {
    const seat = g % playerCount;
    const config = matchConfig({ seed: g, playerCount });
    const agents = new Map<ReturnType<typeof playerId>, Agent>();
    for (let i = 0; i < playerCount; i++) {
      agents.set(playerId(i), makeAgent(i === seat ? a : b, g * 100 + i));
    }
    const final = await runMatch(createMatch(config), agents);
    if (final.result?.winner === seat) aWins += 1;
  }

  return { games, aWins, winRate: aWins / games };
}
