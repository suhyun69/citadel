/**
 * 재작성 전 현재 엔진의 결과를 고정한다.
 *
 *   npx tsx scripts/golden.ts
 *
 * 규칙을 바꾸지 않는 재작성이므로 **같은 시드는 같은 판**이 나와야 한다.
 * 이 파일이 그 판정 기준이다. 새 엔진이 여기서 어긋나면 규칙이 변한 것이다.
 *
 * 최종 상태 전체를 해시로 압축한다 — 어디가 달라졌는지는 못 알려주지만,
 * 달라졌다는 사실은 확실히 알려준다. 어디인지는 시드를 재현해 추적한다.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Agent } from '@/bot/agent';
import { HeuristicAgent } from '@/bot/heuristic';
import { RandomAgent } from '@/bot/random';
import { createMatch, matchConfig } from '@/engine/setup';
import { playerId } from '@/engine/state/ids';
import type { Choice } from '@/engine/state/prompt';
import type { GameState } from '@/engine/state/game-state';
import { runMatch } from '@/runtime/runner';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'golden', 'basic.json');

export const SEEDS = 50;
export const PLAYER_COUNTS = [4, 5, 6, 7] as const;
export const BOT_KINDS = ['normal', 'random'] as const;

export interface GoldenEntry {
  seed: number;
  players: number;
  bot: string;
  rounds: number;
  winner: number;
  /** 플레이어별 [건물, 5종, 완성, 특수, 합계] */
  scores: number[][];
  /** 최종 상태(로그 제외) 해시 */
  hash: string;
  /** 선택 로그 길이 — 진행 경로가 같은지 거칠게 본다 */
  choices: number;
}

export function hashState(state: GameState): string {
  const { log: _log, ...rest } = state;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16);
}

function makeAgent(kind: string, seed: number): Agent {
  return kind === 'random' ? new RandomAgent(kind, seed) : new HeuristicAgent(kind, seed);
}

export async function playGolden(
  seed: number,
  players: number,
  bot: string,
): Promise<GoldenEntry> {
  const config = matchConfig({ seed, playerCount: players });
  const agents = new Map(
    Array.from({ length: players }, (_, i) => [playerId(i), makeAgent(bot, seed * 100 + i)]),
  );
  const choiceLog: Choice[] = [];
  const final = await runMatch(createMatch(config), agents, { choiceLog });

  return {
    seed,
    players,
    bot,
    rounds: final.round,
    winner: final.result?.winner ?? -1,
    scores: (final.result?.scores ?? []).map((s) => [
      s.buildingCost,
      s.allKindsBonus,
      s.completionBonus,
      s.uniqueBonus,
      s.total,
    ]),
    hash: hashState(final),
    choices: choiceLog.length,
  };
}

async function main(): Promise<void> {
  const entries: GoldenEntry[] = [];
  const started = Date.now();

  for (const bot of BOT_KINDS) {
    for (const players of PLAYER_COUNTS) {
      for (let seed = 0; seed < SEEDS; seed++) {
        entries.push(await playGolden(seed, players, bot));
      }
    }
  }

  writeFileSync(OUT, `${JSON.stringify({ entries }, null, 0)}\n`);
  console.log(
    `골든 ${entries.length}판 기록 — ${OUT} (${Date.now() - started}ms)\n` +
      `  봇 ${BOT_KINDS.join('/')} × 인원 ${PLAYER_COUNTS.join(',')} × 시드 0~${SEEDS - 1}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
