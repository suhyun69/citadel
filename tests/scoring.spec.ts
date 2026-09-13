import { describe, expect, it } from 'vitest';
import { explainScore, scoreFor } from '@/engine';
import { defIdOf, playerId } from '@/engine/state/ids';
import { aGame, card } from './helpers/builder';
import { playRandomGame } from './helpers/run';

/**
 * 설명은 점수와 **같은 계산**에서 나와야 한다.
 *
 * 따로 계산하면 언젠가 둘이 어긋나고, 화면은 총점과 맞지 않는 내역을
 * 자신 있게 보여주게 된다. 특히 유령 지구는 어떤 종류로 쓰느냐에 따라
 * 5종 보너스와 소원의 우물이 함께 움직여서, 두 계산이 갈리면 티가 난다.
 */
describe('점수 설명', () => {
  it('내역의 합이 총점과 같다', async () => {
    const gm = await playRandomGame({ seed: 21, playerCount: 5 });
    const state = gm.snapshot();

    for (const p of gm.players()) {
      const x = explainScore(state, p.id);
      expect(x.buildingCost + x.allKindsBonus + x.completion.points + x.uniqueBonus).toBe(x.total);
    }
  });

  it('점수표의 숫자와 한 항목씩 맞는다', async () => {
    const gm = await playRandomGame({ seed: 22, playerCount: 6 });
    const state = gm.snapshot();

    for (const s of gm.result()!.scores) {
      const x = explainScore(state, s.player);
      expect(x.total, `P${s.player} 총점`).toBe(s.total);
      expect(x.buildingCost).toBe(s.buildingCost);
      expect(x.allKindsBonus).toBe(s.allKindsBonus);
      expect(x.completion.points).toBe(s.completionBonus);
      expect(x.uniqueBonus).toBe(s.uniqueBonus);
    }
  });

  it('건물 목록의 비용 합이 건설비용과 같다', async () => {
    const gm = await playRandomGame({ seed: 23, playerCount: 4 });
    const state = gm.snapshot();

    for (const p of gm.players()) {
      const x = explainScore(state, p.id);
      expect(x.buildings.reduce((n, b) => n + b.cost, 0)).toBe(x.buildingCost);
      expect(x.buildings).toHaveLength(p.city().length);
    }
  });

  it('특수 건물 항목의 합이 특수 점수와 같다', async () => {
    for (const seed of [24, 25, 26]) {
      const gm = await playRandomGame({ seed, playerCount: 5 });
      const state = gm.snapshot();

      for (const p of gm.players()) {
        const x = explainScore(state, p.id);
        expect(x.items.reduce((n, i) => n + i.points, 0), `seed=${seed} P${p.id}`).toBe(
          x.uniqueBonus,
        );
      }
    }
  });
});

describe('유령 지구를 무엇으로 셌는지 설명한다', () => {
  it('5종 보너스를 위해 다른 종류로 썼다면 그렇게 알려준다', () => {
    // 상업만 비어 있다 — 유령 지구를 상업으로 쓰면 5종이 채워진다
    const gm = aGame()
      .players(4)
      .player(0, {
        city: [card('temple'), card('watchtower'), card('manor'), card('dragon_gate'), card('ghost_district')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const x = explainScore(gm.snapshot(), playerId(0));
    expect(x.wildcardAs).toBe('trade');
    expect(x.kindsMissing).toEqual([]);
    expect(x.allKindsBonus).toBe(3);

    // 상업으로 썼으니 소원의 우물 관점에서는 특수가 아니다 — 여기선 우물이 없어
    // 드래곤 게이트 2점만 남는다
    expect(x.items).toEqual([
      { kind: 'building', building: 'dragon_gate', card: card('dragon_gate'), points: 2 },
    ]);
  });

  it('특수로 남는 편이 나으면 그대로 뒀다고 알려준다', () => {
    const gm = aGame()
      .players(4)
      .crown(1)
      .player(0, {
        city: [card('ghost_district'), card('wishing_well'), card('dragon_gate'), card('statue')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const x = explainScore(gm.snapshot(), playerId(0));
    expect(x.wildcardAs).toBeNull();

    // 소원의 우물이 유령 지구까지 특수로 세어 4점
    const well = x.items.find((i) => i.kind === 'building' && i.building === 'wishing_well');
    expect(well?.points).toBe(4);
    expect(x.total).toBe(scoreFor(gm.snapshot(), playerId(0)).total);
  });

  it('설명의 종류 판정이 실제 점수 계산과 같은 선택을 쓴다', () => {
    const gm = aGame()
      .players(4)
      .player(0, {
        city: [card('temple'), card('watchtower'), card('manor'), card('dragon_gate'), card('ghost_district')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const x = explainScore(gm.snapshot(), playerId(0));
    const ghost = x.buildings.find((b) => defIdOf(b.card) === 'ghost_district')!;

    // 목록에 적힌 종류가 곧 보너스 계산에 쓰인 종류다
    expect(ghost.kind).toBe(x.wildcardAs);
    expect(x.kindsPresent).toContain(ghost.kind);
  });
});
