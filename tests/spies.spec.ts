import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import type { GameMaster } from '@/engine';
import { isPlayable, missingCards, scoreFor } from '@/engine';
import { matchConfig } from '@/engine/setup';
import { canBuild, citySize, isCityComplete } from '@/engine/rules/build';
import { checkInvariants } from '@/engine/rules/invariants';
import { makeCtx } from '@/engine/effects/ctx';
import { resolveRank8Target, resolveTheaterSwap } from '@/engine/effects/resolvers';
import { theaterPrompt } from '@/engine/effects/buildings/theater';
import { playerId } from '@/engine/state/ids';
import type { Choice, MainAction } from '@/engine/state/prompt';
import { presetDef } from '@/data/types';
import { aGame, card } from './helpers/builder';

function toPrompt(gm: GameMaster): GameMaster {
  while (!gm.awaiting() && !gm.isOver()) gm.advance();
  return gm;
}

function answer(gm: GameMaster, choice: Choice): GameMaster {
  const player = toPrompt(gm).awaiting();
  expect(player, '아무도 답을 기다리고 있지 않습니다').not.toBeNull();
  const verdict = player!.submit(choice);
  expect(verdict.ok ? null : verdict.reason).toBeNull();
  return gm;
}

const act = (gm: GameMaster, action: MainAction) => answer(gm, { type: 'mainAction', action });
const useAbility = (gm: GameMaster, ability: string) => act(gm, { t: 'useAbility', ability });
const menu = (gm: GameMaster): readonly MainAction[] => {
  const p = toPrompt(gm).awaiting()?.prompt();
  return p?.type === 'mainAction' ? p.options : [];
};
const asking = (gm: GameMaster) => toPrompt(gm).awaiting()?.prompt();
const spies = () => aGame().preset('spies');

/** 68장이 여전히 전부 판 위에 있는가. 박물관은 카드를 삼키기 딱 좋다. */
const checkNoCardLost = (gm: GameMaster): boolean =>
  checkInvariants(gm.snapshot()).length === 0;

describe('조합 등록', () => {
  it('카드 22종이 모두 구현되어 플레이할 수 있다', () => {
    expect(missingCards(presetDef('spies'))).toEqual({ characters: [], uniques: [] });
    expect(isPlayable(presetDef('spies'))).toBe(true);
  });

  it('세리를 쓰면 캐릭터가 9장이 된다', () => {
    expect(matchConfig({ seed: 0, playerCount: 4, presetId: 'spies' }).characterIds).toHaveLength(8);
    expect(
      matchConfig({ seed: 0, playerCount: 4, presetId: 'spies', useRank9: true }).characterIds,
    ).toHaveLength(9);
  });
});

describe('금광', () => {
  it('자원 얻기로 금화를 고르면 1닢을 더 받는다', () => {
    const gm = spies()
      .player(0, { gold: 0, city: [card('gold_mine')] })
      .assign(0, 'architect')
      .atRank(7)
      .build();

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    expect(gm.player(playerId(0)).gold()).toBe(3); // 기본 2 + 금광 1
  });

  it('카드를 고르면 금광은 아무 일도 하지 않는다', () => {
    const gm = spies()
      .player(0, { gold: 0, city: [card('gold_mine')] })
      .assign(0, 'architect')
      .atRank(7)
      .build();

    answer(gm, { type: 'gatherMode', mode: 'cards' });
    expect(gm.player(playerId(0)).gold()).toBe(0);
  });

  it('금광이 얹어준 몫을 로그에 남긴다', () => {
    const gm = spies()
      .player(0, { gold: 0, city: [card('gold_mine')] })
      .assign(0, 'architect')
      .atRank(7)
      .build();

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    expect(
      gm.log().some((e) => e.t === 'buildingEffect' && e.effect.kind === 'extraGold'),
    ).toBe(true);
  });
});

describe('바실리카', () => {
  it('건설비용이 홀수인 건물 1채당 1점', () => {
    const gm = spies()
      // 홀수: 사원(1), 수도원(3), 대성당(5) → 3점. 짝수: 예배당(2), 바실리카(4).
      .player(0, {
        city: [card('basilica'), card('temple'), card('monastery'), card('cathedral'), card('chapel')],
      })
      .build();

    expect(scoreFor(gm.snapshot(), playerId(0)).uniqueBonus).toBe(3);
  });

  it('짝수만 있으면 0점', () => {
    const gm = spies()
      .player(0, { city: [card('basilica'), card('chapel'), card('castle')] })
      .build();

    expect(scoreFor(gm.snapshot(), playerId(0)).uniqueBonus).toBe(0);
  });
});

describe('비밀 금고', () => {
  it('절대로 건설할 수 없다', () => {
    const gm = spies()
      .player(0, { gold: 20, hand: [card('secret_vault')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    const state = gm.snapshot();
    const check = canBuild(state, playerId(0), card('secret_vault'), makeCtx(state, playerId(0)));
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('notConstructible');
    expect(menu(gm).some((o) => o.t === 'build')).toBe(false);
  });

  it('손에 든 채로 3점을 준다', () => {
    const gm = spies()
      .player(0, { hand: [card('secret_vault')] })
      .build();

    expect(scoreFor(gm.snapshot(), playerId(0)).uniqueBonus).toBe(3);
  });

  it('손에 없으면 점수도 없다', () => {
    const gm = spies().player(0, { hand: [card('temple')] }).build();
    expect(scoreFor(gm.snapshot(), playerId(0)).uniqueBonus).toBe(0);
  });
});

describe('기념물', () => {
  it('도시에 건물이 5채 이상이면 지을 수 없다', () => {
    const five = [card('temple'), card('chapel'), card('monastery'), card('manor'), card('castle')];
    const gm = spies()
      .player(0, { gold: 20, hand: [card('monument')], city: five })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    const state = gm.snapshot();
    const check = canBuild(state, playerId(0), card('monument'), makeCtx(state, playerId(0)));
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('ownRule');
  });

  it('4채까지는 지을 수 있다', () => {
    const four = [card('temple'), card('chapel'), card('monastery'), card('manor')];
    const gm = spies()
      .player(0, { gold: 20, hand: [card('monument')], city: four })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    const state = gm.snapshot();
    expect(canBuild(state, playerId(0), card('monument'), makeCtx(state, playerId(0))).ok).toBe(true);
  });

  it('도시 완성을 판별할 때 건물 2채로 세어진다', () => {
    // 카드는 6장뿐인데 기념물이 2채로 세어져 7채가 된다.
    const six = [
      card('monument'),
      card('temple'),
      card('chapel'),
      card('monastery'),
      card('manor'),
      card('castle'),
    ];
    const gm = spies().player(0, { city: six }).build();

    expect(gm.player(playerId(0)).city()).toHaveLength(6);
    expect(citySize(gm.snapshot(), playerId(0))).toBe(7);
    expect(isCityComplete(gm.snapshot(), playerId(0))).toBe(true);
  });

  it('점수의 건설비용은 한 채 몫만 더한다', () => {
    const gm = spies().player(0, { city: [card('monument')] }).build();
    expect(scoreFor(gm.snapshot(), playerId(0)).buildingCost).toBe(4);
  });
});

describe('병기고', () => {
  it('자신을 부수면서 남의 건물 1채를 공짜로 파괴한다', () => {
    const gm = spies()
      .player(0, { gold: 0, city: [card('armory')] })
      .player(1, { city: [card('palace')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'armory' });
    answer(gm, { type: 'armoryTarget', target: { player: playerId(1), card: card('palace') } });

    expect(gm.player(playerId(0)).city()).toHaveLength(0); // 병기고도 함께 부서졌다
    expect(gm.player(playerId(1)).city()).toHaveLength(0);
    expect(gm.player(playerId(0)).gold()).toBe(0); // 값은 치르지 않는다
  });

  it('완성된 도시의 건물은 목표가 되지 않는다', () => {
    const seven = [
      card('temple'),
      card('chapel'),
      card('monastery'),
      card('manor'),
      card('castle'),
      card('palace'),
      card('tavern'),
    ];
    const gm = spies()
      .player(0, { city: [card('armory')] })
      .player(1, { city: seven })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    // 부술 상대가 없으면 메뉴에도 오르지 않는다
    expect(menu(gm).some((o) => o.t === 'useBuilding' && o.building === 'armory')).toBe(false);
  });

  it('외성과 주교의 면역은 병기고를 막지 못한다', () => {
    // 외성은 8번 캐릭터 능력만 막는다 (howto.md 외성).
    const gm = spies()
      .player(0, { city: [card('armory')] })
      .player(1, { city: [card('keep')] })
      .assign(0, 'architect')
      .assign(1, 'bishop')
      .atTurn(0)
      .build();

    const prompt = (() => {
      act(gm, { t: 'useBuilding', building: 'armory' });
      return asking(gm);
    })();

    expect(prompt?.type).toBe('armoryTarget');
    const options = prompt?.type === 'armoryTarget' ? prompt.options : [];
    expect(options.some((o) => o.card === card('keep'))).toBe(true);
  });

  it('차례마다 한 번뿐이고, 쓰고 나면 메뉴에서 사라진다', () => {
    const gm = spies()
      .player(0, { city: [card('armory')] })
      .player(1, { city: [card('palace')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'armory' });
    answer(gm, { type: 'armoryTarget', target: { player: playerId(1), card: card('palace') } });
    expect(menu(gm).some((o) => o.t === 'useBuilding' && o.building === 'armory')).toBe(false);
  });
});

describe('박물관', () => {
  it('차례마다 한 번 손패 1장을 아래에 깔고, 1장당 1점을 준다', () => {
    const gm = spies()
      .player(0, { hand: [card('temple'), card('chapel')], city: [card('museum')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'museum' });
    answer(gm, { type: 'tuckCard', card: card('temple') });

    expect(gm.player(playerId(0)).hand()).toEqual([card('chapel')]);
    expect(gm.player(playerId(0)).city()[0]?.beneath).toEqual([card('temple')]);
    // 박물관 4 + 아래 1장 1점
    expect(scoreFor(gm.snapshot(), playerId(0)).uniqueBonus).toBe(1);

    // 한 차례에 두 번은 쓸 수 없다
    expect(menu(gm).some((o) => o.t === 'useBuilding' && o.building === 'museum')).toBe(false);
  });

  /**
   * 점령은 이 조합에 없다 — 8번이 장군(파괴)이라 육군대장이 들어오지 않는다.
   * 그래도 규칙은 규칙이고 코드 경로는 살아 있으므로, 조합을 우회해
   * 해소기를 직접 부른다.
   */
  it('점령되면 아래 깔린 카드도 박물관을 따라간다', () => {
    const gm = spies()
      .player(0, { hand: [card('temple')], city: [card('museum')] })
      .player(1, { gold: 10, city: [card('barracks')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'museum' });
    answer(gm, { type: 'tuckCard', card: card('temple') });

    const after = produce(gm.snapshot(), (s) => {
      resolveRank8Target(s, playerId(1), 'capture', {
        player: playerId(0),
        card: card('museum'),
      });
    });

    const moved = after.players[1]?.city.find((e) => e.card === card('museum'));
    expect(moved?.beneath).toEqual([card('temple')]);
    expect(after.players[0]?.city).toHaveLength(0);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('파괴되면 아래 깔린 카드도 함께 더미로 간다', () => {
    const gm = spies()
      .player(0, { hand: [card('temple')], city: [card('museum')] })
      .player(1, { gold: 10, city: [card('barracks')] })
      .assign(0, 'architect')
      .assign(1, 'warlord')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'museum' });
    answer(gm, { type: 'tuckCard', card: card('temple') });
    act(gm, { t: 'endTurn' });

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    useAbility(gm, 'warlord.destroy');
    answer(gm, { type: 'rank8Target', target: { player: playerId(0), card: card('museum') } });

    expect(gm.player(playerId(0)).city()).toHaveLength(0);
    expect(gm.snapshot().deck).toContain(card('temple'));
    expect(checkNoCardLost(gm)).toBe(true);
  });
});

describe('극장', () => {
  it('선택 단계가 끝날 때 다른 플레이어와 캐릭터를 바꾼다', () => {
    const gm = spies()
      .player(0, { city: [card('theater')] })
      .assign(0, 'witch')
      .assign(1, 'architect')
      .atRank(1)
      .build();

    const before = gm.snapshot();
    expect(theaterPrompt(before)?.player).toBe(playerId(0));

    const after = produce(before, (s) => {
      resolveTheaterSwap(s, playerId(0), playerId(1));
    });

    expect(after.players[0]?.character?.characterId).toBe('architect');
    expect(after.players[1]?.character?.characterId).toBe('witch');
  });

  it('바꾸지 않기를 고르면 아무 일도 없다', () => {
    const gm = spies()
      .player(0, { city: [card('theater')] })
      .assign(0, 'witch')
      .assign(1, 'architect')
      .atRank(1)
      .build();

    const after = produce(gm.snapshot(), (s) => {
      resolveTheaterSwap(s, playerId(0), null);
    });

    expect(after.players[0]?.character?.characterId).toBe('witch');
    expect(after.players[1]?.character?.characterId).toBe('architect');
  });

  it('극장이 없으면 아무에게도 묻지 않는다', () => {
    const gm = spies().assign(0, 'witch').atRank(1).build();
    expect(theaterPrompt(gm.snapshot())).toBeNull();
  });
});

describe('연금술사', () => {
  it('차례가 끝날 때 건설비용을 전부 돌려받는다', () => {
    const gm = spies()
      .player(0, { gold: 5, hand: [card('palace')] }) // 궁전 5닢
      .assign(0, 'alchemist')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('palace') });
    expect(gm.player(playerId(0)).gold()).toBe(0);

    act(gm, { t: 'endTurn' });
    toPrompt(gm);
    expect(gm.player(playerId(0)).gold()).toBe(5); // 전액 환급
  });

  it('대장간에 낸 금화는 돌려받지 못한다', () => {
    const gm = spies()
      .player(0, { gold: 4, city: [card('smithy')] })
      .assign(0, 'alchemist')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'smithy' }); // 2닢 지불
    expect(gm.player(playerId(0)).gold()).toBe(2);

    act(gm, { t: 'endTurn' });
    toPrompt(gm);
    expect(gm.player(playerId(0)).gold()).toBe(2); // 환급 대상이 아니다
  });

  it('구빈원은 환급 전에 판정한다', () => {
    // 금화를 전부 건설에 쏟아 0닢으로 차례를 마치면, 구빈원이 먼저 1닢을
    // 주고 그 다음에 연금술사가 건설비용을 돌려받는다 (howto.md:461).
    const gm = spies()
      .player(0, { gold: 5, hand: [card('palace')], city: [card('poor_house')] })
      .assign(0, 'alchemist')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('palace') });
    act(gm, { t: 'endTurn' });
    toPrompt(gm);

    expect(gm.player(playerId(0)).gold()).toBe(6); // 구빈원 1 + 환급 5
  });

  it('아무것도 짓지 않으면 돌려받을 것도 없다', () => {
    const gm = spies()
      .player(0, { gold: 3 })
      .assign(0, 'alchemist')
      .atTurn(0)
      .build();

    act(gm, { t: 'endTurn' });
    toPrompt(gm);
    expect(gm.player(playerId(0)).gold()).toBe(3);
  });
});

describe('수도원장', () => {
  it('종교 건물 수만큼을 금화와 카드로 나눠 받는다', () => {
    const gm = spies()
      .player(0, { gold: 0, city: [card('temple'), card('chapel'), card('monastery')] })
      .assign(0, 'abbot')
      .atTurn(0)
      .build();

    useAbility(gm, 'abbot.income');
    answer(gm, { type: 'abbotIncome', gold: 2, cards: 1 });

    expect(gm.player(playerId(0)).gold()).toBe(2);
    expect(gm.player(playerId(0)).hand()).toHaveLength(1);
  });

  it('가장 금화가 많은 플레이어에게서 1닢을 받는다', () => {
    const gm = spies()
      .player(0, { gold: 1 })
      .player(1, { gold: 9 })
      .player(2, { gold: 3 })
      .assign(0, 'abbot')
      .atTurn(0)
      .build();

    useAbility(gm, 'abbot.tithe');
    expect(gm.player(playerId(0)).gold()).toBe(2);
    expect(gm.player(playerId(1)).gold()).toBe(8);
  });

  it('최고 부자가 여럿이면 수도원장이 고른다', () => {
    const gm = spies()
      .player(0, { gold: 1 })
      .player(1, { gold: 9 })
      .player(2, { gold: 9 })
      .assign(0, 'abbot')
      .atTurn(0)
      .build();

    useAbility(gm, 'abbot.tithe');
    expect(asking(gm)?.type).toBe('pickPlayer');

    answer(gm, { type: 'pickPlayer', player: playerId(2) });
    expect(gm.player(playerId(1)).gold()).toBe(9);
    expect(gm.player(playerId(2)).gold()).toBe(8);
  });

  it('자기가 최고 부자면 받지 못한다 — 메뉴에도 오르지 않는다', () => {
    const gm = spies()
      .player(0, { gold: 9 })
      .player(1, { gold: 9 })
      .assign(0, 'abbot')
      .atTurn(0)
      .build();

    expect(menu(gm).some((o) => o.t === 'useAbility' && o.ability === 'abbot.tithe')).toBe(false);
  });
});

describe('황제', () => {
  it('왕관을 남에게 넘기고 금화 1닢을 받는다', () => {
    const gm = spies()
      .players(4)
      .crown(3)
      .player(0, { gold: 0 })
      .player(1, { gold: 5, hand: [] })
      .assign(0, 'emperor')
      .atTurn(0)
      .build();

    useAbility(gm, 'emperor.crown');
    answer(gm, { type: 'pickPlayer', player: playerId(1) });

    expect(gm.snapshot().crowned).toBe(playerId(1));
    // 손패가 없으니 고를 것도 없이 금화가 온다
    expect(gm.player(playerId(0)).gold()).toBe(1);
    expect(gm.player(playerId(1)).gold()).toBe(4);
  });

  it('금화와 카드가 둘 다 있으면 무엇을 가져올지 고른다', () => {
    const gm = spies()
      .players(4)
      .crown(3)
      .player(0, { gold: 0 })
      .player(1, { gold: 5, hand: [card('temple')] })
      .assign(0, 'emperor')
      .atTurn(0)
      .build();

    useAbility(gm, 'emperor.crown');
    answer(gm, { type: 'pickPlayer', player: playerId(1) });

    expect(asking(gm)?.type).toBe('emperorTribute');
    answer(gm, { type: 'emperorTribute', take: 'card' });

    expect(gm.player(playerId(0)).hand()).toHaveLength(1);
    expect(gm.player(playerId(1)).gold()).toBe(5); // 금화는 그대로
  });

  it('자기 자신과 현재 왕관 주인은 고를 수 없다', () => {
    const gm = spies()
      .players(4)
      .crown(3)
      .assign(0, 'emperor')
      .atTurn(0)
      .build();

    useAbility(gm, 'emperor.crown');
    const p = asking(gm);
    const options = p?.type === 'pickPlayer' ? p.options : [];
    expect(options).toEqual([playerId(1), playerId(2)]);
  });

  it('왕관을 넘기기 전에는 차례를 끝낼 수 없다', () => {
    const gm = spies().players(4).crown(3).assign(0, 'emperor').atTurn(0).build();

    expect(menu(gm).some((o) => o.t === 'endTurn')).toBe(false);

    useAbility(gm, 'emperor.crown');
    answer(gm, { type: 'pickPlayer', player: playerId(1) });
    expect(menu(gm).some((o) => o.t === 'endTurn')).toBe(true);
  });

  it('암살당하면 라운드가 끝날 때 왕관만 옮기고 대가는 받지 않는다', () => {
    const gm = spies()
      .players(4)
      .crown(3)
      .player(0, { gold: 0, killed: true })
      .player(1, { gold: 5 })
      .assign(0, 'emperor')
      .atRank(9) // 모든 순번이 끝난 직후
      .build();

    answer(gm, { type: 'pickPlayer', player: playerId(1) });

    expect(gm.snapshot().crowned).toBe(playerId(1));
    expect(gm.player(playerId(0)).gold()).toBe(0); // 대리인은 대가를 받지 않는다
    expect(gm.player(playerId(1)).gold()).toBe(5);
  });
});

describe('세리', () => {
  const withTax = () => aGame().preset('spies', true);

  it('건물을 지으면 금화 1닢이 세리 토큰 위로 간다', () => {
    const gm = withTax()
      .player(0, { gold: 5, hand: [card('chapel')] }) // 예배당 2닢
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('chapel') });
    expect(gm.player(playerId(0)).gold()).toBe(2); // 5 − 건설 2 − 세금 1
    expect(gm.snapshot().taxPot).toBe(1);
  });

  it('건설한 뒤 금고가 비었다면 세금을 내지 않는다', () => {
    const gm = withTax()
      .player(0, { gold: 2, hand: [card('chapel')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('chapel') });
    expect(gm.player(playerId(0)).gold()).toBe(0);
    expect(gm.snapshot().taxPot ?? 0).toBe(0);
  });

  it('세리가 쌓인 금화를 통째로 가져간다', () => {
    const gm = withTax()
      .player(0, { gold: 5, hand: [card('chapel'), card('temple')] })
      .player(1, { gold: 0 })
      .assign(0, 'architect')
      .assign(1, 'tax_collector')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('chapel') });
    act(gm, { t: 'build', card: card('temple') }); // 건축가는 여러 채
    expect(gm.snapshot().taxPot).toBe(2);

    act(gm, { t: 'endTurn' });
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    useAbility(gm, 'tax_collector.collect');

    expect(gm.player(playerId(1)).gold()).toBe(4); // 자원 2 + 세금 2
    expect(gm.snapshot().taxPot).toBe(0);
  });

  it('세리를 아무도 고르지 않아도 재산세는 걷힌다', () => {
    const gm = withTax()
      .player(0, { gold: 5, hand: [card('chapel')] })
      .assign(0, 'architect') // 세리는 아무도 안 가졌다
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('chapel') });
    expect(gm.snapshot().taxPot).toBe(1);
  });

  it('세리가 조합에 없으면 재산세도 없다', () => {
    const gm = spies() // rank9 없이
      .player(0, { gold: 5, hand: [card('chapel')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('chapel') });
    expect(gm.player(playerId(0)).gold()).toBe(3);
    expect(gm.snapshot().taxPot).toBeUndefined();
  });
});

describe('협박범', () => {
  it('캐릭터 둘에 토큰을 붙인다 — 어느 쪽이 꽃 자수인지는 공개하지 않는다', () => {
    const gm = spies().assign(0, 'blackmailer').atTurn(0).build();

    useAbility(gm, 'blackmailer.tokens');
    answer(gm, { type: 'blackmailTokens', sealed: 'architect', decoy: 'warlord' });

    const declared = gm.snapshot().action?.declared.blackmail ?? [];
    expect(declared).toHaveLength(2);

    const logged = gm.log().find((e) => e.t === 'blackmailed');
    expect(logged).toBeDefined();
    // 로그에는 이름 둘만 있고 어느 쪽이 진짜인지는 없다
    expect(JSON.stringify(logged)).not.toContain('sealed');
  });

  it('1번 캐릭터와 자기 자신은 협박할 수 없다', () => {
    const gm = spies().assign(0, 'blackmailer').atTurn(0).build();

    useAbility(gm, 'blackmailer.tokens');
    const p = asking(gm);
    const options = p?.type === 'blackmailTokens' ? p.options : [];

    expect(options).not.toContain('witch'); // 1번
    expect(options).not.toContain('blackmailer'); // 자기 자신
    expect(options).toContain('architect');
  });

  it('뇌물을 바치면 금화 절반이 넘어가고 토큰은 앞면을 보지 않고 치워진다', () => {
    const gm = spies()
      .player(0, { gold: 0 })
      .player(1, { gold: 7 })
      .assign(0, 'blackmailer')
      .assign(1, 'architect')
      .atTurn(0)
      .build();

    useAbility(gm, 'blackmailer.tokens');
    answer(gm, { type: 'blackmailTokens', sealed: 'architect', decoy: 'warlord' });
    act(gm, { t: 'endTurn' });

    // 7번 차례: 자원 얻기가 먼저, 그 다음 협박 대응
    answer(gm, { type: 'gatherMode', mode: 'gold' }); // 7 + 2 = 9
    expect(asking(gm)?.type).toBe('bribe');
    answer(gm, { type: 'bribe', pay: true });

    expect(gm.player(playerId(1)).gold()).toBe(5); // 9 − 4
    expect(gm.player(playerId(0)).gold()).toBe(4);
    // 건축가의 토큰만 떨어진다. 아무도 안 가진 장군의 허풍은 그대로 남는다.
    const left = gm.snapshot().action?.declared.blackmail ?? [];
    expect(left.map((b) => b.character)).toEqual(['warlord']);
  });

  it('거절했는데 꽃 자수가 공개되면 금고를 통째로 잃는다', () => {
    const gm = spies()
      .player(0, { gold: 0 })
      .player(1, { gold: 7 })
      .assign(0, 'blackmailer')
      .assign(1, 'architect')
      .atTurn(0)
      .build();

    useAbility(gm, 'blackmailer.tokens');
    answer(gm, { type: 'blackmailTokens', sealed: 'architect', decoy: 'warlord' });
    act(gm, { t: 'endTurn' });

    answer(gm, { type: 'gatherMode', mode: 'gold' }); // 9닢
    answer(gm, { type: 'bribe', pay: false });

    expect(asking(gm)?.type).toBe('revealBlackmail');
    answer(gm, { type: 'revealBlackmail', reveal: true });

    expect(gm.player(playerId(1)).gold()).toBe(0);
    expect(gm.player(playerId(0)).gold()).toBe(9);
  });

  it('허풍이었다면 공개해도 아무 일도 없다', () => {
    const gm = spies()
      .player(0, { gold: 0 })
      .player(1, { gold: 7 })
      .assign(0, 'blackmailer')
      .assign(1, 'architect')
      .atTurn(0)
      .build();

    useAbility(gm, 'blackmailer.tokens');
    // 건축가에는 허풍을, 꽃 자수는 아무도 안 가진 장군에게
    answer(gm, { type: 'blackmailTokens', sealed: 'warlord', decoy: 'architect' });
    act(gm, { t: 'endTurn' });

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'bribe', pay: false });
    answer(gm, { type: 'revealBlackmail', reveal: true });

    expect(gm.player(playerId(1)).gold()).toBe(9);
    expect(gm.player(playerId(0)).gold()).toBe(0);
  });

  it('협박당한 플레이어는 대응하기 전에는 능력을 쓸 수 없다', () => {
    const gm = spies()
      .player(0, { gold: 0 })
      .player(1, { gold: 7, city: [card('smithy')] })
      .assign(0, 'blackmailer')
      .assign(1, 'architect')
      .atTurn(0)
      .build();

    useAbility(gm, 'blackmailer.tokens');
    answer(gm, { type: 'blackmailTokens', sealed: 'architect', decoy: 'warlord' });
    act(gm, { t: 'endTurn' });

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    // 차례 메뉴가 아니라 협박 대응이 먼저 온다
    expect(asking(gm)?.type).toBe('bribe');
  });
});

describe('마녀', () => {
  const bewitchGame = () =>
    spies()
      .player(0, { gold: 0 })
      .player(1, { gold: 0 })
      .assign(0, 'witch')
      .assign(1, 'architect')
      .atRank(1)
      .build();

  it('자원 얻기 뒤에는 선언 말고 할 수 있는 것이 없다', () => {
    const gm = bewitchGame();
    answer(gm, { type: 'gatherMode', mode: 'gold' });

    // 차례 메뉴가 열리지 않는다 — 곧장 지목 질문이다
    expect(asking(gm)?.type).toBe('namedCharacter');
    const p = asking(gm);
    expect(p?.type === 'namedCharacter' ? p.purpose : null).toBe('bewitch');
  });

  it('선언하면 그 자리에서 차례가 멈춘다', () => {
    const gm = bewitchGame();
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'namedCharacter', characterId: 'architect' });

    expect(gm.snapshot().action?.declared.witchTarget).toBe('architect');
    expect(gm.player(playerId(0)).gold()).toBe(2); // 자원은 챙겼다
  });

  it('마법에 걸린 캐릭터는 자원 얻기만 하고 차례를 마친다', () => {
    const gm = bewitchGame();
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'namedCharacter', characterId: 'architect' });

    // 7번 호명 — 걸린 쪽의 자원 얻기
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    expect(gm.player(playerId(1)).gold()).toBe(2);

    // 건축가의 카드 뽑기 능력은 쓸 수 없다 — 다음 질문은 마녀 몫이다
    expect(toPrompt(gm).awaiting()?.id).toBe(playerId(0));
  });

  it('마녀가 그 캐릭터의 능력을 이어받아 차례를 진행한다', () => {
    const gm = bewitchGame();
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'namedCharacter', characterId: 'architect' });
    answer(gm, { type: 'gatherMode', mode: 'gold' }); // 걸린 쪽

    // 이제 마녀의 차례 — 건축가로서
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    expect(gm.player(playerId(0)).gold()).toBe(4); // 2 + 2

    // 건축가의 능력이 마녀에게 붙어 있다
    expect(menu(gm).some((o) => o.t === 'useAbility' && o.ability === 'architect.draw')).toBe(true);
  });

  it('마법을 건 캐릭터가 판에 없으면 마녀는 그냥 차례를 마친다', () => {
    const gm = bewitchGame();
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    // 아무도 안 가진 캐릭터를 지목한다
    answer(gm, { type: 'namedCharacter', characterId: 'emperor' });

    // 7번(건축가)은 평소대로 자기 차례를 온전히 쓴다
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    expect(toPrompt(gm).awaiting()?.id).toBe(playerId(1));
    expect(menu(gm).some((o) => o.t === 'useAbility' && o.ability === 'architect.draw')).toBe(true);
  });
});

describe('마녀 — 규칙서가 따로 짚은 자리들', () => {
  it('황제가 마법에 걸리면 왕관을 줄 상대도 마녀가 정하고 대가도 마녀가 받는다', () => {
    const gm = spies()
      .players(4)
      .crown(3)
      .player(0, { gold: 0 })
      .player(1, { gold: 0 })
      .player(2, { gold: 5, hand: [] })
      .assign(0, 'witch')
      .assign(1, 'emperor')
      .atRank(1)
      .build();

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'namedCharacter', characterId: 'emperor' });

    // 4번 호명 — 걸린 황제는 자원만 얻고 끝난다. 왕관은 움직이지 않는다.
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    expect(gm.snapshot().crowned).toBe(playerId(3));

    // 마녀가 황제로서 차례를 이어받는다
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    useAbility(gm, 'emperor.crown');
    answer(gm, { type: 'pickPlayer', player: playerId(2) });

    expect(gm.snapshot().crowned).toBe(playerId(2));
    expect(gm.player(playerId(0)).gold()).toBe(5); // 2 + 2 + 조공 1 — 마녀가 받는다
    expect(gm.player(playerId(1)).gold()).toBe(2); // 걸린 황제는 자원 얻기뿐
  });

  it('멈춘 차례에는 공원이 발동하지 않고, 이어받은 차례에서 발동한다', () => {
    const gm = spies()
      .player(0, { gold: 0, hand: [], city: [card('park')] })
      .player(1, { gold: 0 })
      .assign(0, 'witch')
      .assign(1, 'architect')
      .atRank(1)
      .build();

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'namedCharacter', characterId: 'architect' });

    // 멈춘 차례가 끝났지만 손패는 여전히 비어 있다 (howto.md:456)
    expect(gm.player(playerId(0)).hand()).toHaveLength(0);

    answer(gm, { type: 'gatherMode', mode: 'gold' }); // 걸린 건축가
    answer(gm, { type: 'gatherMode', mode: 'gold' }); // 마녀의 이어받은 차례
    act(gm, { t: 'endTurn' });
    toPrompt(gm);

    expect(gm.player(playerId(0)).hand()).toHaveLength(2); // 공원 2장
  });

  it('마녀가 이어받아도 자기 도시와 금고만 쓴다', () => {
    const gm = spies()
      .player(0, { gold: 0, hand: [] })
      .player(1, { gold: 20, hand: [card('palace')] })
      .assign(0, 'witch')
      .assign(1, 'architect')
      .atRank(1)
      .build();

    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'namedCharacter', characterId: 'architect' });
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    answer(gm, { type: 'gatherMode', mode: 'gold' });

    // 상대 손패의 궁전은 마녀의 선택지가 아니다
    expect(menu(gm).some((o) => o.t === 'build')).toBe(false);
    expect(gm.player(playerId(1)).hand()).toEqual([card('palace')]);
  });
});
