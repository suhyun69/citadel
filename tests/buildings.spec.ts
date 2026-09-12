import { describe, expect, it } from 'vitest';
import { applyChoice, step } from '@/engine/machine';
import { scoreFor } from '@/engine/phases/scoring';
import { checkInvariants } from '@/engine/rules/invariants';
import { destroyTargets } from '@/engine/rules/rank8';
import { playerId } from '@/engine/state/ids';
import type { GameState } from '@/engine/state/game-state';
import type { MainAction } from '@/engine/state/prompt';
import type { UniqueBuildingId } from '@/data/types';
import { aGame, card } from './helpers/builder';

function toPending(s: GameState): GameState {
  let cur = s;
  while (!cur.pending && cur.phase !== 'finished') cur = step(cur);
  return cur;
}

function act(s: GameState, action: MainAction): GameState {
  const cur = toPending(s);
  expect(cur.pending?.type).toBe('mainAction');
  return applyChoice(cur, { type: 'mainAction', action });
}

const useAbility = (s: GameState, ability: string) => act(s, { t: 'useAbility', ability });
const useBuilding = (s: GameState, building: UniqueBuildingId) =>
  act(s, { t: 'useBuilding', building });

/** 지금 차례 메뉴의 선택지. */
function menuOptions(s: GameState): readonly MainAction[] {
  const p = toPending(s).pending;
  return p?.type === 'mainAction' ? p.options : [];
}

const canUseBuilding = (s: GameState, id: UniqueBuildingId): boolean =>
  menuOptions(s).some((o) => o.t === 'useBuilding' && o.building === id);

/**
 * ★ 이 파일에서 가장 중요한 묶음.
 *
 * 마법학교와 유령 지구는 둘 다 "원하는 종류로 간주" 지만 적용 시점이 배타적이다.
 * 한 메커니즘으로 합치면 아래 네 가지 중 둘이 조용히 깨진다.
 */
describe('마법학교와 유령 지구는 정반대다', () => {
  /**
   * 종교·군사·귀족·특수 + 문제의 카드 한 장. **상업만 비어 있는 것**이 관건이다.
   * 드래곤 게이트로 특수를 따로 채워두지 않으면, 유령 지구가 상업이 되는 순간
   * 이번엔 특수가 비어 5종이 안 된다 — 한 장이 두 종류를 겸할 수는 없다.
   */
  const cityWith = (last: string) => [
    card('temple'),
    card('watchtower'),
    card('manor'),
    card('dragon_gate'),
    card(last),
  ];

  it('마법학교는 수입을 늘린다 (상인의 상업 건물로 세어진다)', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, city: cityWith('school_of_magic') })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    s = useAbility(s, 'merchant.income');
    expect(s.players[0]!.gold).toBe(1); // 마법학교를 상업으로 세어 1닢
  });

  it('마법학교는 5종 보너스를 채우지 못한다', () => {
    const s = aGame()
      .players(4)
      .player(0, { city: cityWith('school_of_magic') })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    // 종교·군사·귀족·특수만 있고 상업이 없다 — 마법학교가 메워주면 안 된다
    expect(scoreFor(s, playerId(0)).allKindsBonus).toBe(0);
  });

  it('유령 지구는 5종 보너스를 채운다', () => {
    const s = aGame()
      .players(4)
      .player(0, { city: cityWith('ghost_district') })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    expect(scoreFor(s, playerId(0)).allKindsBonus).toBe(3);
  });

  it('유령 지구는 수입을 늘리지 못한다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, city: cityWith('ghost_district') })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    s = useAbility(s, 'merchant.income');
    expect(s.players[0]!.gold).toBe(0);
  });
});

describe('유령 지구 × 소원의 우물', () => {
  it('5종 보너스가 더 크면 다른 종류로 쓴다', () => {
    const s = aGame()
      .players(4)
      .player(0, {
        city: [card('temple'), card('watchtower'), card('manor'), card('ghost_district'), card('wishing_well')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const score = scoreFor(s, playerId(0));
    // 유령 지구를 상업으로 → 5종 3점, 특수는 소원의 우물 하나뿐이라 1점
    expect(score.allKindsBonus).toBe(3);
    expect(score.uniqueBonus).toBe(1);
  });

  it('특수 건물로 남는 편이 더 크면 그대로 둔다', () => {
    const s = aGame()
      .players(4)
      .crown(1) // 동상이 점수를 주지 않도록 왕관을 남에게 둔다
      .player(0, {
        city: [card('ghost_district'), card('wishing_well'), card('dragon_gate'), card('statue')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const score = scoreFor(s, playerId(0));
    expect(score.allKindsBonus).toBe(0); // 어차피 5종을 못 채운다
    // 소원의 우물 4 (유령 지구 포함) + 드래곤 게이트 2 + 동상 0(왕관 없음)
    expect(score.uniqueBonus).toBe(4 + 2);
  });
});

describe('도서관', () => {
  it('자원 얻기로 뽑은 카드를 전부 손에 든다', () => {
    let s = aGame()
      .players(4)
      .player(0, { city: [card('library')] })
      .assign(0, 'merchant')
      .atTurn(0, 'gather')
      .build();

    s = toPending(s);
    expect(s.pending?.type).toBe('gatherMode');
    s = applyChoice(s, { type: 'gatherMode', mode: 'cards' });

    // keep === draw 이므로 고를 것이 없어 pending 없이 바로 손에 들어온다
    s = toPending(s);
    expect(s.players[0]!.hand).toHaveLength(2);
    expect(checkInvariants(s)).toEqual([]);
  });
});

describe('공장과 도적 소굴', () => {
  it('공장이 특수 건물 비용을 1닢 깎는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 10, hand: [card('statue')], city: [card('factory')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const after = act(s, { t: 'build', card: card('statue') });
    expect(after.players[0]!.gold).toBe(8); // 동상 3닢 − 1
  });

  it('도적 소굴은 건설비용을 카드로 낼 수 있고, 자기 자신으로는 낼 수 없다', () => {
    let s = aGame()
      .players(4)
      .player(0, {
        gold: 2,
        hand: [card('thieves_den'), card('temple'), card('chapel'), card('manor'), card('castle')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    s = act(s, { t: 'build', card: card('thieves_den') });
    expect(s.pending?.type).toBe('buildPayment');
    expect(s.pending).toMatchObject({ cost: 6, maxCards: 4 });

    // 자기 자신을 지불에 넣으면 거부된다
    expect(() =>
      applyChoice(s, { type: 'buildPayment', gold: 2, cards: [card('thieves_den'), card('temple'), card('chapel'), card('manor')] }),
    ).toThrow();

    s = applyChoice(s, {
      type: 'buildPayment',
      gold: 2,
      cards: [card('temple'), card('chapel'), card('manor'), card('castle')],
    });

    expect(s.players[0]!.gold).toBe(0);
    expect(s.players[0]!.city.map((e) => e.card)).toEqual([card('thieves_den')]);
    expect(s.players[0]!.hand).toHaveLength(0);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('공장이 있으면 도적 소굴 비용도 5닢으로 줄어든다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 5, hand: [card('thieves_den'), card('temple')], city: [card('factory')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const after = act(s, { t: 'build', card: card('thieves_den') });
    expect(after.pending).toMatchObject({ cost: 5, maxCards: 1 });
  });
});

describe('채석장', () => {
  it('이름이 같은 건물을 또 지을 수 있다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 5, hand: [card('temple', 2)], city: [card('temple', 1), card('quarry')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    s = act(s, { t: 'build', card: card('temple', 2) });
    expect(s.players[0]!.city).toHaveLength(3);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('동명 건물이 5종 보너스에서 두 번 세어지지 않는다', () => {
    const s = aGame()
      .players(4)
      .player(0, {
        city: [card('temple', 1), card('temple', 2), card('watchtower'), card('manor'), card('quarry')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    // 종교·군사·귀족·특수 — 상업이 없다
    expect(scoreFor(s, playerId(0)).allKindsBonus).toBe(0);
  });
});

describe('외성', () => {
  it('외성 카드 한 장만 지킨다 (주교처럼 도시 전체가 아니다)', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city: [card('keep'), card('prison')] })
      .assign(0, 'warlord')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    const targets = destroyTargets(s, playerId(0));
    expect(targets.map((t) => t.card)).toEqual([card('prison')]);
  });
});

describe('차례마다 한 번 쓰는 건물', () => {
  it('실험실: 카드 1장을 버리고 금화 2닢을 받는다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, hand: [card('temple')], city: [card('laboratory')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    s = useBuilding(s, 'laboratory');
    expect(s.pending?.type).toBe('discardCard');
    s = applyChoice(s, { type: 'discardCard', card: card('temple') });

    expect(s.players[0]!.gold).toBe(2);
    expect(s.players[0]!.hand).toHaveLength(0);
    expect(s.deck.at(-1)).toBe(card('temple'));

    // 같은 차례에 두 번은 못 쓴다 (손패도 없다)
    expect(canUseBuilding(s, 'laboratory')).toBe(false);
  });

  it('대장간: 금화 2닢을 내고 카드 3장을 받는다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 3, city: [card('smithy')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    s = useBuilding(s, 'smithy');
    expect(s.players[0]!.gold).toBe(1);
    expect(s.players[0]!.hand).toHaveLength(3);
    expect(checkInvariants(s)).toEqual([]);

    expect(canUseBuilding(s, 'smithy')).toBe(false);
  });

  it('대장간은 금화가 모자라면 메뉴에 뜨지 않는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 1, city: [card('smithy')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    expect(canUseBuilding(s, 'smithy')).toBe(false);
  });
});

describe('게임 종료 점수', () => {
  it('제국 보고는 남은 금화만큼, 지도 보관실은 손패만큼 준다', () => {
    const s = aGame()
      .players(4)
      .player(0, {
        gold: 7,
        hand: [card('temple'), card('chapel')],
        city: [card('imperial_treasury'), card('map_room')],
      })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    expect(scoreFor(s, playerId(0)).uniqueBonus).toBe(7 + 2);
  });

  it('동상은 왕관을 가지고 있을 때만 5점을 준다', () => {
    const withCrown = aGame()
      .players(4)
      .crown(0)
      .player(0, { city: [card('statue')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();
    const without = aGame()
      .players(4)
      .crown(1)
      .player(0, { city: [card('statue')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    expect(scoreFor(withCrown, playerId(0)).uniqueBonus).toBe(5);
    expect(scoreFor(without, playerId(0)).uniqueBonus).toBe(0);
  });

  it('드래곤 게이트는 무조건 2점', () => {
    const s = aGame()
      .players(4)
      .player(0, { city: [card('dragon_gate')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();
    expect(scoreFor(s, playerId(0)).uniqueBonus).toBe(2);
  });
});
