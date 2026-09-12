import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '@/bot/heuristic';
import { createGame } from '@/engine';
import { playerId } from '@/engine/state/ids';
import { runMatch } from '@/runtime/runner';
import { formatEvent } from '@/ui/format';
import { Pacer } from '@/ui/pacer';
import { fingerprint } from './helpers/run';

/** 관전 화면이 쓰는 것과 똑같은 방식으로 한 판 돌린다. */
async function watchOne(seed: number, playerCount = 4) {
  const agents = new Map(
    Array.from({ length: playerCount }, (_, i) => [
      playerId(i),
      new HeuristicAgent(`normal${i}`, seed * 100 + i),
    ]),
  );
  const pacer = new Pacer();
  pacer.speedMs = 0;
  return runMatch(createGame({ seed, playerCount }), agents, { clock: pacer, stepDelayMs: 1 });
}

describe('관전 화면이 의존하는 성질', () => {
  it('같은 시드는 같은 판을 재현한다', async () => {
    const a = await watchOne(7);
    const b = await watchOne(7);
    expect(fingerprint(a.snapshot())).toBe(fingerprint(b.snapshot()));
    expect(a.result()?.winner).toBe(b.result()?.winner);
  });

  it('다른 시드는 다른 판이 된다', async () => {
    const a = await watchOne(7);
    const c = await watchOne(8);
    expect(fingerprint(a.snapshot())).not.toBe(fingerprint(c.snapshot()));
  });

  it('모든 이벤트가 사람이 읽는 줄로 바뀐다', async () => {
    const s = await watchOne(3, 5);
    // roundEnd 만 의도적으로 숨긴다 — 화면에 보여줄 내용이 없다
    const shown = s.log().filter((e) => e.t !== 'roundEnd');
    for (const e of shown) {
      const f = formatEvent(e);
      expect(f, `${e.t} 를 표시할 수 없습니다`).not.toBeNull();
      expect(f?.text.length).toBeGreaterThan(0);
    }
    expect(shown.length).toBeGreaterThan(50);
  });
});

describe('Pacer', () => {
  it('일시정지하면 한 스텝을 부를 때까지 멈춘다', async () => {
    const pacer = new Pacer();
    pacer.speedMs = 0;
    pacer.pause();

    let resolved = false;
    const waiting = pacer.delay().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    pacer.stepOnce();
    await waiting;
    expect(resolved).toBe(true);
  });

  it('재생하면 대기 중이던 것이 풀린다', async () => {
    const pacer = new Pacer();
    pacer.speedMs = 0;
    pacer.pause();
    const waiting = pacer.delay();
    pacer.play();
    await expect(waiting).resolves.toBeUndefined();
    expect(pacer.paused).toBe(false);
  });

  it('중단하면 이후 대기가 즉시 풀린다', async () => {
    const pacer = new Pacer();
    pacer.pause();
    const waiting = pacer.delay();
    pacer.abort();
    await waiting;
    await expect(pacer.delay()).resolves.toBeUndefined();
  });
});
