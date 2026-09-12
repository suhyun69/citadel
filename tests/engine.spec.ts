import { describe, expect, it } from 'vitest';
import { characterDef } from '@/data/types';
import { createGame, type GameMaster } from '@/engine';
import { NEVER_FACE_UP_RANK, discardCounts } from '@/engine/rules/selection-table';
import { replay } from '@/runtime/replay';
import { fingerprint, playRandomGame } from './helpers/run';

/** 선택 단계가 시작되어 첫 질문이 뜰 때까지 진행한다. */
function untilFirstPick(seed: number, playerCount: number): GameMaster {
  const gm = createGame({ seed, playerCount });
  while (!gm.awaiting()) gm.advance();
  return gm;
}

describe('결정론', () => {
  it('같은 시드 + 같은 봇이면 최종 상태가 완전히 같다', async () => {
    const a = await playRandomGame({ seed: 7, playerCount: 5 });
    const b = await playRandomGame({ seed: 7, playerCount: 5 });
    expect(fingerprint(a.snapshot())).toBe(fingerprint(b.snapshot()));
  });

  it('다른 시드면 다른 판이 나온다', async () => {
    const a = await playRandomGame({ seed: 1, playerCount: 4 });
    const b = await playRandomGame({ seed: 2, playerCount: 4 });
    expect(fingerprint(a.snapshot())).not.toBe(fingerprint(b.snapshot()));
  });

  it('시드 + 제출 기록으로 판을 그대로 되살린다', async () => {
    const original = await playRandomGame({ seed: 42, playerCount: 6 });
    const restored = replay({
      config: original.snapshot().config,
      choices: original.history(),
    });
    expect(fingerprint(restored.snapshot())).toBe(fingerprint(original.snapshot()));
  });
});

describe('선택 단계', () => {
  it('인원수별 버림 장수가 규칙표와 맞는다', () => {
    for (const playerCount of [4, 5, 6, 7]) {
      const s = untilFirstPick(0, playerCount);
      const sel = s.snapshot().selection;
      const want = discardCounts(playerCount);
      expect(sel?.faceUp).toHaveLength(want.faceUp);
      expect(sel?.faceDown).toHaveLength(want.faceDown);
      // 캐릭터 8장 = 앞면 + 뒷면 + 남은 더미
      expect((sel?.faceUp.length ?? 0) + (sel?.faceDown.length ?? 0) + (sel?.pool.length ?? 0)).toBe(8);
    }
  });

  it('4번 캐릭터는 절대로 앞면으로 버려지지 않는다', () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = untilFirstPick(seed, 4); // 앞면 2장 — 가장 잘 걸리는 인원수
      for (const id of s.snapshot().selection?.faceUp ?? []) {
        expect(characterDef(id).rank).not.toBe(NEVER_FACE_UP_RANK);
      }
    }
  });

  it('4번 캐릭터가 뒷면으로는 버려질 수 있다', () => {
    let sawRank4FaceDown = false;
    for (let seed = 0; seed < 300 && !sawRank4FaceDown; seed++) {
      const s = untilFirstPick(seed, 4);
      sawRank4FaceDown = (s.snapshot().selection?.faceDown ?? []).some(
        (id) => characterDef(id).rank === NEVER_FACE_UP_RANK,
      );
    }
    expect(sawRank4FaceDown).toBe(true);
  });

  it('7인 게임의 마지막 픽커는 뒷면 버림까지 2장 중에 고른다', () => {
    const gm = untilFirstPick(3, 7);
    const optionCounts: number[] = [];

    // 선택 단계가 끝날 때까지 랜덤봇 대신 항상 첫 선택지를 고른다.
    while (gm.snapshot().selection) {
      const player = gm.awaiting();
      const prompt = player?.prompt();
      if (prompt?.type === 'selectCharacter') {
        optionCounts.push(prompt.options.length);
        const first = prompt.options[0];
        expect(first).toBeDefined();
        player!.submit({ type: 'selectCharacter', characterId: first! });
      } else {
        gm.advance();
      }
    }

    // 8장 − 뒷면 1장 = 7장에서 시작해 한 장씩 줄다가,
    // 마지막(7번째) 픽커에서 뒷면 버림 1장이 합류해 2장이 된다.
    expect(optionCounts).toEqual([7, 6, 5, 4, 3, 2, 2]);
  });

  it('선택이 끝나면 모든 플레이어가 캐릭터를 정확히 1장씩 가진다', async () => {
    const s = await playRandomGame({ seed: 11, playerCount: 5 });
    // 게임이 끝난 상태에서도 마지막 라운드의 캐릭터가 남아 있다
    const held = s.snapshot().players.filter((p) => p.character !== null);
    expect(held).toHaveLength(5);
    const ids = held.map((p) => p.character!.characterId);
    expect(new Set(ids).size).toBe(5); // 같은 캐릭터를 둘이 가질 수 없다
  });
});

describe('게임 종료', () => {
  it('도시를 완성한 플레이어가 있어야 끝난다', async () => {
    const s = await playRandomGame({ seed: 5, playerCount: 4 });
    expect(s.phase()).toBe('finished');
    expect(s.snapshot().players.some((p) => p.city.length >= s.snapshot().config.targetCitySize)).toBe(true);
    expect(s.snapshot().firstCompleted).not.toBeNull();
  });

  it('최초 완성자는 4점, 그 외 완성자는 2점을 받는다', async () => {
    const s = await playRandomGame({ seed: 5, playerCount: 4 });
    for (const score of s.result()!.scores) {
      const p = s.snapshot().players[score.player]!;
      if (p.cityCompletedAtRound === null) expect(score.completionBonus).toBe(0);
      else if (s.snapshot().firstCompleted === score.player) expect(score.completionBonus).toBe(4);
      else expect(score.completionBonus).toBe(2);
    }
  });

  it('점수 합계가 구성 요소의 합과 같다', async () => {
    const s = await playRandomGame({ seed: 9, playerCount: 6 });
    for (const x of s.result()!.scores) {
      expect(x.total).toBe(x.buildingCost + x.allKindsBonus + x.completionBonus + x.uniqueBonus);
    }
  });
});
