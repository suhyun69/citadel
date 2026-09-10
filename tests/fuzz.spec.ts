import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '@/bot/heuristic';
import { checkInvariants } from '@/engine/rules/invariants';
import { createMatch, matchConfig } from '@/engine/setup';
import { playerId } from '@/engine/types/ids';
import { runMatch } from '@/runtime/runner';
import { playRandomGame } from './helpers/run';

/**
 * 랜덤봇 퍼즈.
 *
 * 랜덤봇을 쓰는 이유는 성능이 아니라 **탐색 범위**다. 휴리스틱 봇은 사람이
 * 둘 법한 수만 두느라 이상한 상태 공간을 밟지 않는다. 엔진 버그는 그 이상한
 * 곳에 있다.
 *
 *   npm test        → 기본(빠름)
 *   npm run fuzz    → FUZZ_SEEDS=250, 4~7인 × 250시드 = 1000판
 */
const SEEDS = Number(process.env['FUZZ_SEEDS'] ?? 60);
const PLAYER_COUNTS = [4, 5, 6, 7] as const;

describe(`랜덤봇 퍼즈 (${SEEDS}시드 × ${PLAYER_COUNTS.length}인원 = ${SEEDS * PLAYER_COUNTS.length}판)`, () => {
  for (const playerCount of PLAYER_COUNTS) {
    it(`${playerCount}인 게임 ${SEEDS}판이 불변식을 지키며 완주한다`, async () => {
      for (let seed = 0; seed < SEEDS; seed++) {
        const final = await playRandomGame({ seed, playerCount, verifyInvariants: true });

        expect(checkInvariants(final), `seed=${seed}`).toEqual([]);
        expect(final.phase, `seed=${seed}`).toBe('finished');
        expect(final.round, `seed=${seed}`).toBeLessThanOrEqual(final.config.maxRounds);
        expect(final.result, `seed=${seed}`).not.toBeNull();

        // 도시를 완성한 플레이어가 반드시 있어야 게임이 끝난다
        expect(
          final.players.some((p) => p.cityCompletedAtRound !== null),
          `seed=${seed}`,
        ).toBe(true);

        // 점수는 전부 유한하고, 승자는 최고점이다
        const top = Math.max(...final.result!.scores.map((s) => s.total));
        const winner = final.result!.scores.find((s) => s.player === final.result!.winner)!;
        expect(winner.total, `seed=${seed}`).toBe(top);
        for (const s of final.result!.scores) expect(Number.isFinite(s.total)).toBe(true);
      }
    });
  }
});

/**
 * 휴리스틱 봇은 무작위 봇과 전혀 다른 경로를 밟는다 — 실제로 건물을 짓고,
 * 능력을 순서대로 쓰고, 도시를 빠르게 완성한다. 무작위 퍼즈가 안 건드리는
 * 상태(완성된 도시, 두둑한 금고, 긴 손패)를 여기서 훑는다.
 */
describe('휴리스틱 봇 퍼즈', () => {
  it('실전에 가까운 진행에서도 불변식이 유지된다', async () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const playerCount of [4, 7]) {
        const config = matchConfig({ seed, playerCount });
        const agents = new Map(
          Array.from({ length: playerCount }, (_, i) => [
            playerId(i),
            new HeuristicAgent(`h${i}`, seed * 100 + i),
          ]),
        );
        const final = await runMatch(createMatch(config), agents, { verifyInvariants: true });
        expect(checkInvariants(final), `seed=${seed} players=${playerCount}`).toEqual([]);
        expect(final.phase).toBe('finished');
      }
    }
  }, 120_000);
});
