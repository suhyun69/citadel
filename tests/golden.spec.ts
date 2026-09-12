import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playGolden, type GoldenEntry } from '../scripts/golden';

/**
 * 재작성이 규칙을 건드리지 않았음을 증명하는 테스트.
 *
 * `tests/golden/basic.json` 은 재작성 **전** 엔진이 낸 결과다. 규칙을 안
 * 바꿨으므로 같은 시드는 같은 판이 나와야 한다. 여기서 어긋나면 구조를
 * 옮기다가 규칙이 변한 것이고, 시드를 재현해 추적하면 된다.
 *
 * 해시가 달라지면 최종 상태 어딘가가 다르다는 뜻이고, 그 앞의 필드들
 * (라운드 수·승자·점수·선택 수)이 어느 층에서 갈렸는지 좁혀준다.
 */
const golden = JSON.parse(
  readFileSync(new URL('./golden/basic.json', import.meta.url), 'utf8'),
) as { entries: GoldenEntry[] };

const byBot = (bot: string): GoldenEntry[] => golden.entries.filter((e) => e.bot === bot);

describe('골든 대조 — 재작성 전후 같은 판이 나오는가', () => {
  it('골든 파일이 온전하다', () => {
    expect(golden.entries).toHaveLength(400);
    expect(new Set(golden.entries.map((e) => e.hash)).size).toBe(400);
  });

  for (const bot of ['normal', 'random']) {
    it(`${bot} 봇 200판이 기록과 완전히 일치한다`, async () => {
      for (const want of byBot(bot)) {
        const got = await playGolden(want.seed, want.players, want.bot);
        const where = `seed=${want.seed} players=${want.players} bot=${want.bot}`;

        // 넓은 것부터 좁혀 본다 — 어느 층에서 갈렸는지 바로 드러나도록
        expect(got.rounds, `${where} 라운드 수`).toBe(want.rounds);
        expect(got.winner, `${where} 승자`).toBe(want.winner);
        expect(got.scores, `${where} 점수`).toEqual(want.scores);
        expect(got.choices, `${where} 선택 수`).toBe(want.choices);
        expect(got.hash, `${where} 최종 상태 해시`).toBe(want.hash);
      }
    }, 120_000);
  }
});
