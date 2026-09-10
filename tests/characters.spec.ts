import { describe, expect, it } from 'vitest';
import { applyChoice, step } from '@/engine/machine';
import { checkInvariants } from '@/engine/rules/invariants';
import { destroyPrice, destroyTargets } from '@/engine/rules/rank8';
import { playerId } from '@/engine/types/ids';
import type { GameState } from '@/engine/types/state';
import type { MainAction } from '@/engine/types/decision';
import { aGame, card } from './helpers/builder';
import { playRandomGame } from './helpers/run';

/** pending 이 뜰 때까지 진행한다. */
function toPending(s: GameState): GameState {
  let cur = s;
  while (!cur.pending && cur.phase !== 'finished') cur = step(cur);
  return cur;
}

/** 지금 메뉴에서 해당 능력을 골라 실행한다. */
function useAbility(s: GameState, ability: string): GameState {
  const cur = toPending(s);
  expect(cur.pending?.type).toBe('mainAction');
  const action: MainAction = { t: 'useAbility', ability };
  return applyChoice(cur, { type: 'mainAction', action });
}

/** namedCharacter pending 의 선택지를 꺼낸다. */
function namedOptions(s: GameState): readonly string[] {
  const p = s.pending;
  expect(p?.type).toBe('namedCharacter');
  return p?.type === 'namedCharacter' ? p.options : [];
}

function abilities(s: GameState): string[] {
  const cur = toPending(s);
  if (cur.pending?.type !== 'mainAction') return [];
  return cur.pending.options.filter((o) => o.t === 'useAbility').map((o) => o.ability);
}

describe('암살자', () => {
  it('지목한 캐릭터는 차례를 쉰다', () => {
    let s = aGame().players(4).assign(0, 'assassin').assign(1, 'king').atTurn(0).build();

    s = useAbility(s, 'assassin.kill');
    expect(s.pending?.type).toBe('namedCharacter');
    s = applyChoice(s, { type: 'namedCharacter', characterId: 'king' });

    expect(s.players[1]!.character!.killed).toBe(true);
    expect(s.action!.declared.assassinTarget).toBe('king');

    // 차례를 끝내고 4번이 호명될 때까지 진행하면 왕은 건너뛰어진다
    s = applyChoice(toPending(s), { type: 'mainAction', action: { t: 'endTurn' } });
    while (s.action && s.action.rankCursor <= 4 && !s.pending) s = step(s);
    expect(s.log.some((e) => e.t === 'skipped' && e.player === 1)).toBe(true);
  });

  it('자기 자신은 지목할 수 없다', () => {
    let s = aGame().players(4).assign(0, 'assassin').atTurn(0).build();
    s = useAbility(s, 'assassin.kill');
    const options = namedOptions(s);
    expect(options).not.toContain('assassin');
    expect(options).toHaveLength(7);
  });
});

describe('도둑', () => {
  it('목표가 공개될 때 개인 금고를 통째로 가져온다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 1 })
      .player(1, { gold: 6 })
      .assign(0, 'thief')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    s = useAbility(s, 'thief.rob');
    s = applyChoice(s, { type: 'namedCharacter', characterId: 'merchant' });
    s = applyChoice(toPending(s), { type: 'mainAction', action: { t: 'endTurn' } });

    while (s.action && s.action.rankCursor <= 6 && !s.pending) s = step(s);

    expect(s.players[0]!.gold).toBe(7); // 1 + 6
    expect(s.players[1]!.gold).toBe(0);
    expect(s.log.some((e) => e.t === 'stolen' && e.gold === 6)).toBe(true);
  });

  it('1번 캐릭터와 암살당한 캐릭터는 지목할 수 없다', () => {
    let s = aGame().players(4).assign(0, 'thief').assign(1, 'king').atTurn(0).build();
    s.action!.declared.assassinTarget = 'king';

    s = useAbility(s, 'thief.rob');
    const options = namedOptions(s);
    expect(options).not.toContain('assassin'); // 1번
    expect(options).not.toContain('king'); // 암살당함
    expect(options).not.toContain('thief'); // 자기 자신
  });
});

describe('마술사', () => {
  it('다른 플레이어와 손패를 통째로 교환한다', () => {
    let s = aGame()
      .players(4)
      .player(0, { hand: [card('temple'), card('chapel')] })
      .player(1, { hand: [card('castle'), card('palace'), card('manor')] })
      .assign(0, 'magician')
      .atTurn(0)
      .build();

    s = useAbility(s, 'magician.magic');
    expect(s.pending?.type).toBe('magicianMode');
    s = applyChoice(s, { type: 'magicianMode', mode: 'swap', target: playerId(1) });

    expect(s.players[0]!.hand).toHaveLength(3);
    expect(s.players[1]!.hand).toHaveLength(2);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('버린 만큼 새로 뽑고, 버린 카드는 더미 맨 아래로 간다', () => {
    let s = aGame()
      .players(4)
      .player(0, { hand: [card('temple'), card('chapel')] })
      .assign(0, 'magician')
      .atTurn(0)
      .build();

    const deckBefore = s.deck.length;
    s = useAbility(s, 'magician.magic');
    s = applyChoice(s, { type: 'magicianMode', mode: 'redraw', discard: [card('temple')] });

    expect(s.players[0]!.hand).toHaveLength(2);
    expect(s.players[0]!.hand).not.toContain(card('temple'));
    expect(s.deck).toHaveLength(deckBefore); // 1장 나가고 1장 들어옴
    expect(s.deck.at(-1)).toBe(card('temple'));
    expect(checkInvariants(s)).toEqual([]);
  });
});

describe('왕', () => {
  it('차례가 시작되면 왕관을 가져온다', () => {
    // atRank 로 4번 호명 직전 상태를 만들어야 onTurnStart 가 실제로 돈다.
    let s = aGame().players(4).crown(2).assign(0, 'king').atRank(4).build();
    expect(s.crowned).toBe(playerId(2));
    s = toPending(s);
    expect(s.crowned).toBe(playerId(0));
  });

  it('암살당해도 라운드 종료 시 왕관을 가져간다', () => {
    let s = aGame()
      .players(4)
      .crown(3)
      .assign(0, 'king')
      .player(0, { killed: true })
      .atRank(4)
      .build();

    while (s.phase === 'action' && !s.pending) s = step(s);
    expect(s.crowned).toBe(playerId(0));
    expect(s.log.some((e) => e.t === 'crownMoved' && e.reason.includes('계승'))).toBe(true);
  });

  it('귀족 건물 수만큼 금화를 받는다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('manor'), card('castle'), card('temple')] })
      .assign(0, 'king')
      .atTurn(0)
      .build();

    s = useAbility(s, 'king.income');
    expect(s.players[0]!.gold).toBe(2); // 저택 + 성
  });
});

describe('주교', () => {
  it('도시 전체가 8번 캐릭터의 대상에서 빠진다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city: [card('temple'), card('castle')] })
      .assign(0, 'warlord')
      .assign(1, 'bishop')
      .atTurn(0)
      .build();

    expect(destroyTargets(s, playerId(0))).toEqual([]);
  });

  it('암살당하면 방어가 사라진다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city: [card('temple'), card('castle')] })
      .assign(0, 'warlord')
      .assign(1, 'bishop')
      .player(1, { killed: true, city: [card('temple'), card('castle')] })
      .atTurn(0)
      .build();

    expect(destroyTargets(s, playerId(0))).toHaveLength(2);
  });

  it('종교 건물 수만큼 금화를 받는다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('temple'), card('chapel'), card('castle')] })
      .assign(0, 'bishop')
      .atTurn(0)
      .build();

    s = useAbility(s, 'bishop.income');
    expect(s.players[0]!.gold).toBe(2);
  });
});

describe('상인', () => {
  it('보너스 1닢과 상업 수입을 따로 받는다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('tavern'), card('market')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    expect(abilities(s).sort()).toEqual(['merchant.bonus', 'merchant.income']);

    s = useAbility(s, 'merchant.bonus');
    expect(s.players[0]!.gold).toBe(1);
    s = useAbility(s, 'merchant.income');
    expect(s.players[0]!.gold).toBe(3);

    // 같은 능력을 두 번 쓸 수 없다
    expect(abilities(s)).toEqual([]);
  });
});

describe('건축가', () => {
  it('카드를 2장 더 받는다', () => {
    let s = aGame().players(4).assign(0, 'architect').atTurn(0).build();
    s = useAbility(s, 'architect.draw');
    expect(s.players[0]!.hand).toHaveLength(2);
    expect(checkInvariants(s)).toEqual([]);
  });

  it('건물을 3채까지 짓는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 10, hand: [card('temple'), card('chapel'), card('manor'), card('tavern')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();
    expect(s.action!.turn!.buildLimit).toBe(3);
  });
});

describe('장군', () => {
  it('파괴비용은 건설비용보다 1닢 적고, 1닢짜리는 공짜다', () => {
    expect(destroyPrice(card('watchtower'))).toBe(0); // 망루 1닢
    expect(destroyPrice(card('prison'))).toBe(1); // 감옥 2닢
    expect(destroyPrice(card('palace'))).toBe(4); // 궁전 5닢
  });

  it('건물을 파괴하면 카드가 더미 맨 아래로 간다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 5 })
      .player(1, { city: [card('prison')] })
      .assign(0, 'warlord')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    s = useAbility(s, 'warlord.destroy');
    expect(s.pending?.type).toBe('warlordTarget');
    s = applyChoice(s, {
      type: 'warlordTarget',
      target: { player: playerId(1), card: card('prison') },
    });

    expect(s.players[1]!.city).toHaveLength(0);
    expect(s.players[0]!.gold).toBe(4); // 5 − 1
    expect(s.deck.at(-1)).toBe(card('prison'));
    expect(checkInvariants(s)).toEqual([]);
  });

  it('완성된 도시는 건드릴 수 없다', () => {
    const city = ['temple', 'chapel', 'manor', 'tavern', 'watchtower', 'prison', 'market'].map((d) =>
      card(d),
    );
    const s = aGame()
      .players(4)
      .player(0, { gold: 9 })
      .player(1, { city })
      .assign(0, 'warlord')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    expect(s.players[1]!.city).toHaveLength(7);
    expect(destroyTargets(s, playerId(0))).toEqual([]);
  });

  it('금화가 모자라면 선택지에 뜨지 않는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 0 })
      .player(1, { city: [card('palace'), card('watchtower')] })
      .assign(0, 'warlord')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    // 궁전은 4닢이라 불가, 망루는 공짜라 가능
    expect(destroyTargets(s, playerId(0)).map((t) => t.card)).toEqual([card('watchtower')]);
  });

  it('군사 건물 수만큼 금화를 받는다', () => {
    let s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('watchtower'), card('prison'), card('temple')] })
      .assign(0, 'warlord')
      .atTurn(0)
      .build();

    s = useAbility(s, 'warlord.income');
    expect(s.players[0]!.gold).toBe(2);
  });
});

describe('무작위 대전에서 능력이 실제로 발동한다', () => {
  it('암살·절도·파괴·왕관 이동이 모두 로그에 나타난다', async () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const s = await playRandomGame({ seed, playerCount: 5 });
      for (const e of s.log) seen.add(e.t);
    }
    expect(seen).toContain('skipped'); // 암살
    expect(seen).toContain('stolen'); // 도둑
    expect(seen).toContain('destroyed'); // 장군
    expect(seen).toContain('crownMoved'); // 왕
  });
});
