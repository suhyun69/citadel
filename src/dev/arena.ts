/**
 * 봇끼리 붙여 승률을 잰다.
 *
 *   npm run arena -- --games 200 --players 4 --a normal --b random
 *
 * A 봇 1명 + B 봇 나머지로 붙이고, **좌석을 매판 돌린다** — 왕관이 좌석 0에서
 * 시작하므로 좌석 고정으로 재면 선수 이점이 승률에 섞인다.
 */
import { RandomAgent } from '@/bot/random';
import { HeuristicAgent, POLICIES } from '@/bot/heuristic';
import type { Agent } from '@/bot/agent';
import { createMatch, matchConfig } from '@/engine/setup';
import { playerId } from '@/engine/types/ids';
import { runMatch } from '@/runtime/runner';

function makeAgent(kind: string, name: string, seed: number): Agent {
  if (kind === 'random') return new RandomAgent(name, seed);
  const policy = POLICIES[kind];
  if (!policy) throw new Error(`알 수 없는 봇 종류: ${kind} (가능: random, easy, normal)`);
  return new HeuristicAgent(name, seed, policy);
}

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

async function main(): Promise<void> {
  const games = Number(arg('--games', '200'));
  const playerCount = Number(arg('--players', '4'));
  const aKind = arg('--a', 'normal');
  const bKind = arg('--b', 'random');

  let aWins = 0;
  let aScore = 0;
  let bScore = 0;
  const started = Date.now();

  for (let g = 0; g < games; g++) {
    const seat = g % playerCount; // 좌석 회전
    const config = matchConfig({ seed: g, playerCount });

    const agents = new Map<ReturnType<typeof playerId>, Agent>();
    for (let i = 0; i < playerCount; i++) {
      const kind = i === seat ? aKind : bKind;
      agents.set(playerId(i), makeAgent(kind, `${kind}${i}`, g * 100 + i));
    }

    const final = await runMatch(createMatch(config), agents);
    if (final.result?.winner === seat) aWins += 1;

    for (const s of final.result?.scores ?? []) {
      if (s.player === seat) aScore += s.total;
      else bScore += s.total;
    }
  }

  const rate = (aWins / games) * 100;
  const expected = (1 / playerCount) * 100;
  console.log(
    `${aKind} vs ${bKind} × ${playerCount}인 ${games}판\n` +
      `  ${aKind} 승률 ${rate.toFixed(1)}% (무작위 기대 ${expected.toFixed(1)}%)\n` +
      `  평균 점수 ${aKind} ${(aScore / games).toFixed(1)} vs ${bKind} ${(bScore / games / (playerCount - 1)).toFixed(1)}\n` +
      `  ${Date.now() - started}ms`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
