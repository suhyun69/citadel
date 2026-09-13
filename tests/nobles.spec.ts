import { describe, expect, it } from 'vitest';
import type { GameMaster } from '@/engine';
import { isPlayable, missingCards, scoreFor } from '@/engine';
import { matchConfig } from '@/engine/setup';
import { captureTargets, destroyPrice, destroyTargets } from '@/engine/rules/rank8';
import { checkInvariants } from '@/engine/rules/invariants';
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
const nobles = () => aGame().preset('nobles');

describe('조합 등록', () => {
  it('카드 22종이 모두 구현되어 플레이할 수 있다', () => {
    expect(missingCards(presetDef('nobles'))).toEqual({ characters: [], uniques: [] });
    expect(isPlayable(presetDef('nobles'))).toBe(true);
  });

  it('왕비를 쓰면 캐릭터가 9장이 된다', () => {
    expect(matchConfig({ seed: 0, playerCount: 5, presetId: 'nobles' }).characterIds).toHaveLength(8);
    expect(
      matchConfig({ seed: 0, playerCount: 5, presetId: 'nobles', useRank9: true }).characterIds,
    ).toHaveLength(9);
  });

  it('왕비는 5명 미만 게임에 쓸 수 없다', () => {
    expect(() =>
      matchConfig({ seed: 0, playerCount: 4, presetId: 'nobles', useRank9: true }),
    ).toThrow(/왕비/);
  });
});

describe('대공', () => {
  it('왕관을 가져오고 귀족 건물 수만큼 카드를 받는다', () => {
    const gm = nobles()
      .players(4)
      .crown(2)
      .player(0, { city: [card('manor'), card('castle'), card('temple')] })
      .assign(0, 'archduke')
      .atRank(4)
      .build();

    toPrompt(gm);
    expect(gm.snapshot().crowned).toBe(playerId(0)); // 왕관은 강제 — 차례가 시작되자마자

    // atRank 로 시작하면 자원 얻기부터다. 금화를 받아 손패를 비워 둔다.
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    useAbility(gm, 'archduke.income');

    expect(gm.player(playerId(0)).hand()).toHaveLength(2); // 금화가 아니라 카드
    expect(gm.player(playerId(0)).gold()).toBe(4); // 2 + 자원 얻기 2 — 수입은 카드로 왔다
  });
});

describe('교역상', () => {
  it('상업 건물은 건설 횟수에 포함되지 않는다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 10, hand: [card('tavern'), card('market'), card('temple')] })
      .assign(0, 'trader')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('tavern') });
    act(gm, { t: 'build', card: card('market') });
    // 상업만 두 채 지었는데도 평범한 1채 건설이 남아 있다
    act(gm, { t: 'build', card: card('temple') });

    expect(gm.player(playerId(0)).city()).toHaveLength(3);
    expect(gm.snapshot().action!.turn!.buildsUsed).toBe(1);
  });

  it('상업 건물 수만큼 금화를 받는다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 0, city: [card('tavern'), card('market'), card('temple')] })
      .assign(0, 'trader')
      .atTurn(0)
      .build();

    useAbility(gm, 'trader.income');
    expect(gm.player(playerId(0)).gold()).toBe(2);
  });
});

describe('왕비', () => {
  it('옆자리에 공개된 4번이 있으면 금화 3닢', () => {
    const gm = nobles()
      .players(5)
      .player(0, { gold: 0 })
      .assign(0, 'queen')
      .assign(1, 'archduke')
      .player(1, { revealed: true })
      .atTurn(0)
      .build();

    useAbility(gm, 'queen.bonus');
    expect(gm.player(playerId(0)).gold()).toBe(3);
  });

  it('4번이 멀리 앉아 있으면 능력이 뜨지 않는다', () => {
    const gm = nobles()
      .players(5)
      .assign(0, 'queen')
      .assign(2, 'archduke') // 옆자리가 아니다
      .player(2, { revealed: true })
      .atTurn(0)
      .build();

    expect(menu(gm).some((o) => o.t === 'useAbility' && o.ability === 'queen.bonus')).toBe(false);
  });
});

describe('마법사', () => {
  it('상대를 고른 뒤 그 손패에서 1장을 가져온다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 0 })
      .player(1, { hand: [card('temple'), card('palace')] })
      .assign(0, 'wizard')
      .atTurn(0)
      .build();

    useAbility(gm, 'wizard.take');
    expect(gm.awaiting()?.prompt()?.type).toBe('pickPlayer');

    answer(gm, { type: 'pickPlayer', player: playerId(1) });
    expect(gm.awaiting()?.prompt()?.type).toBe('takeCard');

    answer(gm, { type: 'takeCard', card: card('temple') });

    expect(gm.player(playerId(0)).hand()).toContain(card('temple'));
    expect(gm.player(playerId(1)).hand()).toEqual([card('palace')]);
    expect(checkInvariants(gm.snapshot())).toEqual([]);
  });

  it('가져온 카드를 바로 지으면 건설 횟수에 포함되지 않는다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 5, hand: [card('chapel')] })
      .player(1, { hand: [card('temple')] })
      .assign(0, 'wizard')
      .atTurn(0)
      .build();

    useAbility(gm, 'wizard.take');
    answer(gm, { type: 'pickPlayer', player: playerId(1) });
    answer(gm, { type: 'takeCard', card: card('temple') });
    answer(gm, { type: 'buildTaken', build: true });

    expect(gm.player(playerId(0)).city().map((e) => e.card)).toEqual([card('temple')]);
    expect(gm.snapshot().action!.turn!.buildsUsed).toBe(0);

    // 그래서 이번 차례에 평범한 건설이 아직 남아 있다
    act(gm, { t: 'build', card: card('chapel') });
    expect(gm.player(playerId(0)).city()).toHaveLength(2);
  });

  it('이름이 같은 건물도 지을 수 있다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 5, hand: [card('temple', 2)], city: [card('temple', 1)] })
      .assign(0, 'wizard')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('temple', 2) });
    expect(gm.player(playerId(0)).city()).toHaveLength(2);
  });
});

describe('육군대장', () => {
  it('건설비용 3닢 이하만 점령할 수 있다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city: [card('temple'), card('palace')] }) // 1닢 / 5닢
      .assign(0, 'marshal')
      .assign(1, 'trader')
      .atTurn(0)
      .build();

    expect(captureTargets(gm.snapshot(), playerId(0)).map((t) => t.card)).toEqual([card('temple')]);
  });

  it('점령하면 주인에게 값을 치르고 내 도시로 가져온다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 5 })
      .player(1, { gold: 1, city: [card('prison')] }) // 2닢
      .assign(0, 'marshal')
      .assign(1, 'trader')
      .atTurn(0)
      .build();

    useAbility(gm, 'marshal.capture');
    answer(gm, {
      type: 'rank8Target',
      target: { player: playerId(1), card: card('prison') },
    });

    expect(gm.player(playerId(0)).city().map((e) => e.card)).toEqual([card('prison')]);
    expect(gm.player(playerId(1)).city()).toHaveLength(0);
    expect(gm.player(playerId(0)).gold()).toBe(3); // 5 − 2
    expect(gm.player(playerId(1)).gold()).toBe(3); // 1 + 2 — 파괴와 달리 주인이 받는다
    expect(checkInvariants(gm.snapshot())).toEqual([]);
  });

  it('이미 같은 이름을 가지고 있으면 가져올 수 없다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 9, city: [card('prison', 1)] })
      .player(1, { city: [card('prison', 2)] })
      .assign(0, 'marshal')
      .assign(1, 'trader')
      .atTurn(0)
      .build();

    expect(captureTargets(gm.snapshot(), playerId(0))).toEqual([]);
  });
});

describe('치안판사', () => {
  /** 영장을 붙이고 차례를 넘겨, 몰수 대상이 건설하는 지점까지 진행한다. */
  function withWarrantOn(target: 'trader' | 'archduke') {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 0 })
      .player(1, { gold: 5, hand: [card('palace')] })
      .assign(0, 'magistrate')
      .assign(1, target)
      .atTurn(0)
      .build();

    useAbility(gm, 'magistrate.warrants');
    answer(gm, { type: 'warrants', sealed: target, decoys: ['bishop', 'architect'] });
    return gm;
  }

  it('인장 찍힌 캐릭터가 금화로 지으면 몰수 여부를 묻는다', () => {
    const gm = withWarrantOn('trader');
    expect(gm.snapshot().action!.declared.warrants).toHaveLength(3);

    act(gm, { t: 'endTurn' });
    while (gm.snapshot().action!.turn?.playerId !== playerId(1) && !gm.isOver()) {
      if (gm.awaiting()) break;
      gm.advance();
    }

    // 교역상의 차례로 넘어가 궁전을 짓는다
    while (gm.awaiting()?.id !== playerId(1)) gm.advance();
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    act(gm, { t: 'build', card: card('palace') });

    // 건설이 멈추고 치안판사에게 질문이 간다
    expect(gm.awaiting()?.id).toBe(playerId(0));
    expect(gm.awaiting()?.prompt()?.type).toBe('seize');

    answer(gm, { type: 'seize', seize: true });

    expect(gm.player(playerId(0)).city().map((e) => e.card)).toEqual([card('palace')]);
    expect(gm.player(playerId(1)).city()).toHaveLength(0);
    // 건설비용은 애초에 빠져나가지 않았다 — 자원 얻기 2닢을 더한 7닢 그대로
    expect(gm.player(playerId(1)).gold()).toBe(7);
    expect(checkInvariants(gm.snapshot())).toEqual([]);
  });

  it('공개하지 않으면 건설이 그대로 진행된다', () => {
    const gm = withWarrantOn('trader');
    act(gm, { t: 'endTurn' });
    while (gm.awaiting()?.id !== playerId(1)) gm.advance();
    answer(gm, { type: 'gatherMode', mode: 'gold' });
    act(gm, { t: 'build', card: card('palace') });

    answer(gm, { type: 'seize', seize: false });

    expect(gm.player(playerId(1)).city().map((e) => e.card)).toEqual([card('palace')]);
    expect(gm.player(playerId(0)).city()).toHaveLength(0);
    expect(gm.player(playerId(1)).gold()).toBe(2); // 7 − 5
  });

  it('인장이 없는 캐릭터는 건드리지 않는다', () => {
    const gm = withWarrantOn('archduke'); // 인장은 대공에게, 건설하는 건 교역상이 아니다
    const state = gm.snapshot();
    expect(state.action!.declared.warrants.find((w) => w.sealed)?.character).toBe('archduke');
  });
});

describe('새 특수 건물', () => {
  it('마구간 — 건설 횟수에 포함되지 않는다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 10, hand: [card('stables'), card('temple'), card('chapel')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('stables') });
    expect(gm.snapshot().action!.turn!.buildsUsed).toBe(0);

    act(gm, { t: 'build', card: card('temple') });
    expect(gm.snapshot().action!.turn!.buildsUsed).toBe(1);
  });

  it('골조 — 부수고 한 채를 공짜로 짓는다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 0, hand: [card('palace')], city: [card('framework')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();

    act(gm, { t: 'useBuilding', building: 'framework' });
    answer(gm, { type: 'freeBuild', card: card('palace') });

    expect(gm.player(playerId(0)).city().map((e) => e.card)).toEqual([card('palace')]);
    expect(gm.player(playerId(0)).gold()).toBe(0); // 궁전 5닢을 내지 않았다
    expect(gm.snapshot().deck.at(-1)).toBe(card('framework'));
    expect(checkInvariants(gm.snapshot())).toEqual([]);
  });

  it('공동묘지 — 건물 1채를 부수고 공짜로 짓는다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 0, hand: [card('graveyard')], city: [card('temple')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();

    act(gm, { t: 'build', card: card('graveyard') });
    expect(gm.awaiting()?.prompt()?.type).toBe('sacrificeBuild');

    answer(gm, { type: 'sacrificeBuild', sacrifice: card('temple') });

    expect(gm.player(playerId(0)).city().map((e) => e.card)).toEqual([card('graveyard')]);
    expect(gm.player(playerId(0)).gold()).toBe(0);
    expect(checkInvariants(gm.snapshot())).toEqual([]);
  });

  it('장성 — 8번 능력에 금화 1닢이 더 붙는다 (장성 자신은 예외)', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city: [card('great_wall'), card('prison')] })
      .assign(0, 'marshal')
      .assign(1, 'trader')
      .atTurn(0)
      .build();

    const state = gm.snapshot();
    const wall = state.players[1]!.city[0]!;
    const prison = state.players[1]!.city[1]!;

    expect(destroyPrice(state, playerId(1), prison)).toBe(1 + 1); // 감옥 2닢 − 1, +장성
    expect(destroyPrice(state, playerId(1), wall)).toBe(5); // 장성 6닢 − 1, 자기에겐 안 붙는다
  });

  it('공원 — 차례를 마칠 때 손이 비어 있으면 카드 2장', () => {
    const gm = nobles()
      .players(4)
      .player(0, { hand: [], city: [card('park')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();

    act(gm, { t: 'endTurn' });
    toPrompt(gm);
    expect(gm.player(playerId(0)).hand()).toHaveLength(2);
  });

  it('구빈원 — 차례를 마칠 때 금고가 비어 있으면 금화 1닢', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 0, city: [card('poor_house')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();

    act(gm, { t: 'endTurn' });
    toPrompt(gm);
    expect(gm.player(playerId(0)).gold()).toBe(1);
  });

  it('의사당 — 같은 종류 3채면 3점, 여러 종류가 채워도 한 번만', () => {
    const three = nobles()
      .players(4)
      .player(0, { city: [card('temple'), card('chapel'), card('monastery'), card('capitol')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();
    expect(scoreFor(three.snapshot(), playerId(0)).uniqueBonus).toBe(3);

    const two = nobles()
      .players(4)
      .player(0, { city: [card('temple'), card('chapel'), card('capitol')] })
      .assign(0, 'archduke')
      .atTurn(0)
      .build();
    expect(scoreFor(two.snapshot(), playerId(0)).uniqueBonus).toBe(0);
  });
});

describe('장군은 이 조합에 없다', () => {
  it('파괴 대상 계산은 그대로 살아 있다', () => {
    const gm = nobles()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city: [card('prison')] })
      .assign(0, 'marshal')
      .assign(1, 'trader')
      .atTurn(0)
      .build();

    // 육군대장은 파괴가 아니라 점령을 쓴다
    expect(destroyTargets(gm.snapshot(), playerId(0)).length).toBeGreaterThan(0);
    expect(menu(gm).some((o) => o.t === 'useAbility' && o.ability === 'warlord.destroy')).toBe(false);
  });
});
