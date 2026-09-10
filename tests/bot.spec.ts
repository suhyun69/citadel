import { describe, expect, it } from 'vitest';
import { arena } from './helpers/arena';

describe('휴리스틱 봇', () => {
  it('무작위 봇을 상대로 압도한다', async () => {
    const r = await arena('normal', 'random', 200);
    expect(r.winRate).toBeGreaterThan(0.7);
  }, 60_000);

  it('건설만 우선하는 봇보다 강하다', async () => {
    const r = await arena('normal', 'easy', 200);
    expect(r.winRate).toBeGreaterThan(0.6);
  }, 60_000);

  it('건설 우선 봇도 무작위 봇보다는 강하다', async () => {
    const r = await arena('easy', 'random', 200);
    expect(r.winRate).toBeGreaterThan(0.4);
  }, 60_000);

  /**
   * 아레나 자체의 보정 검사. 같은 봇끼리 붙이면 1/인원수 근처가 나와야 한다.
   * 크게 벗어나면 승률 숫자가 아니라 측정 방식이 잘못된 것이다.
   */
  it('같은 봇끼리는 좌석 편향 없이 균등하다', async () => {
    const r = await arena('normal', 'normal', 200);
    expect(r.winRate).toBeGreaterThan(0.15);
    expect(r.winRate).toBeLessThan(0.4);
  }, 60_000);
});
