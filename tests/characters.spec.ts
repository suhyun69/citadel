import { describe, expect, it } from 'vitest';
import type { GameMaster } from '@/engine';
import { checkInvariants } from '@/engine/rules/invariants';
import { destroyPrice, destroyTargets } from '@/engine/rules/rank8';
import { playerId } from '@/engine/state/ids';
import type { Choice } from '@/engine/state/prompt';
import { aGame, card } from './helpers/builder';
import { playRandomGame } from './helpers/run';

/** 누군가에게 질문이 갈 때까지 진행한다. */
function toPrompt(gm: GameMaster): GameMaster {
  while (!gm.awaiting() && !gm.isOver()) gm.advance();
  return gm;
}

/** 지금 질문받은 플레이어의 답을 제출한다. 거절되면 이유를 드러내며 실패한다. */
function answer(gm: GameMaster, choice: Choice): GameMaster {
  const player = toPrompt(gm).awaiting();
  expect(player, '아무도 답을 기다리고 있지 않습니다').not.toBeNull();

  const verdict = player!.submit(choice);
  expect(verdict.ok ? null : verdict.reason).toBeNull();
  return gm;
}

/** 지금 메뉴에서 해당 능력을 골라 실행한다. */
function useAbility(gm: GameMaster, ability: string): GameMaster {
  expect(toPrompt(gm).awaiting()?.prompt()?.type).toBe('mainAction');
  return answer(gm, { type: 'mainAction', action: { t: 'useAbility', ability } });
}

/** namedCharacter 질문의 선택지를 꺼낸다. */
function namedOptions(gm: GameMaster): readonly string[] {
  const prompt = gm.awaiting()?.prompt();
  expect(prompt?.type).toBe('namedCharacter');
  return prompt?.type === 'namedCharacter' ? prompt.options : [];
}

/** 지금 쓸 수 있는 능력 키. Player.options() 를 통해 본다. */
function abilities(gm: GameMaster): string[] {
  const prompt = toPrompt(gm).awaiting()?.prompt();
  if (prompt?.type !== 'mainAction') return [];
  return prompt.options.filter((o) => o.t === 'useAbility').map((o) => o.ability);
}

describe('암살자', () => {
  it('지목한 캐릭터는 차례를 쉰다', () => {
    const s = aGame().players(4).assign(0, 'assassin').assign(1, 'king').atTurn(0).build();

    useAbility(s, 'assassin.kill');
    expect(s.awaiting()?.prompt()?.type).toBe('namedCharacter');
    answer(s, { type: 'namedCharacter', characterId: 'king' });

    expect(s.snapshot().players[1]!.character!.killed).toBe(true);
    expect(s.snapshot().action!.declared.assassinTarget).toBe('king');

    // 차례를 끝내고 4번이 호명될 때까지 진행하면 왕은 건너뛰어진다
    answer(s, { type: 'mainAction', action: { t: 'endTurn' } });
    while (s.snapshot().action && s.snapshot().action!.rankCursor <= 4 && !s.awaiting()) s.advance();
    expect(s.log().some((e) => e.t === 'skipped' && e.player === 1)).toBe(true);
  });

  it('자기 자신은 지목할 수 없다', () => {
    const s = aGame().players(4).assign(0, 'assassin').atTurn(0).build();
    useAbility(s, 'assassin.kill');
    const options = namedOptions(s);
    expect(options).not.toContain('assassin');
    expect(options).toHaveLength(7);
  });
});

describe('도둑', () => {
  it('목표가 공개될 때 개인 금고를 통째로 가져온다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 1 })
      .player(1, { gold: 6 })
      .assign(0, 'thief')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    useAbility(s, 'thief.rob');
    answer(s, { type: 'namedCharacter', characterId: 'merchant' });
    answer(s, { type: 'mainAction', action: { t: 'endTurn' } });

    while (s.snapshot().action && s.snapshot().action!.rankCursor <= 6 && !s.awaiting()) s.advance();

    expect(s.snapshot().players[0]!.gold).toBe(7); // 1 + 6
    expect(s.snapshot().players[1]!.gold).toBe(0);
    expect(s.log().some((e) => e.t === 'stolen' && e.gold === 6)).toBe(true);
  });

  it('1번 캐릭터와 암살당한 캐릭터는 지목할 수 없다', () => {
    const s = aGame().players(4).assign(0, 'thief').assign(1, 'king').atTurn(0).build();
    s.snapshot().action!.declared.assassinTarget = 'king';

    useAbility(s, 'thief.rob');
    const options = namedOptions(s);
    expect(options).not.toContain('assassin'); // 1번
    expect(options).not.toContain('king'); // 암살당함
    expect(options).not.toContain('thief'); // 자기 자신
  });
});

describe('마술사', () => {
  it('다른 플레이어와 손패를 통째로 교환한다', () => {
    const s = aGame()
      .players(4)
      .player(0, { hand: [card('temple'), card('chapel')] })
      .player(1, { hand: [card('castle'), card('palace'), card('manor')] })
      .assign(0, 'magician')
      .atTurn(0)
      .build();

    useAbility(s, 'magician.magic');
    expect(s.awaiting()?.prompt()?.type).toBe('magicianMode');
    answer(s, { type: 'magicianMode', mode: 'swap', target: playerId(1) });

    expect(s.snapshot().players[0]!.hand).toHaveLength(3);
    expect(s.snapshot().players[1]!.hand).toHaveLength(2);
    expect(checkInvariants(s.snapshot())).toEqual([]);
  });

  it('버린 만큼 새로 뽑고, 버린 카드는 더미 맨 아래로 간다', () => {
    const s = aGame()
      .players(4)
      .player(0, { hand: [card('temple'), card('chapel')] })
      .assign(0, 'magician')
      .atTurn(0)
      .build();

    const deckBefore = s.snapshot().deck.length;
    useAbility(s, 'magician.magic');
    answer(s, { type: 'magicianMode', mode: 'redraw', discard: [card('temple')] });

    expect(s.snapshot().players[0]!.hand).toHaveLength(2);
    expect(s.snapshot().players[0]!.hand).not.toContain(card('temple'));
    expect(s.snapshot().deck).toHaveLength(deckBefore); // 1장 나가고 1장 들어옴
    expect(s.snapshot().deck.at(-1)).toBe(card('temple'));
    expect(checkInvariants(s.snapshot())).toEqual([]);
  });
});

describe('왕', () => {
  it('차례가 시작되면 왕관을 가져온다', () => {
    // atRank 로 4번 호명 직전 상태를 만들어야 onTurnStart 가 실제로 돈다.
    const s = aGame().players(4).crown(2).assign(0, 'king').atRank(4).build();
    expect(s.snapshot().crowned).toBe(playerId(2));
    toPrompt(s);
    expect(s.snapshot().crowned).toBe(playerId(0));
  });

  it('암살당해도 라운드 종료 시 왕관을 가져간다', () => {
    const s = aGame()
      .players(4)
      .crown(3)
      .assign(0, 'king')
      .player(0, { killed: true })
      .atRank(4)
      .build();

    while (s.phase() === 'action' && !s.awaiting()) s.advance();
    expect(s.snapshot().crowned).toBe(playerId(0));
    expect(s.log().some((e) => e.t === 'crownMoved' && e.reason.includes('계승'))).toBe(true);
  });

  it('귀족 건물 수만큼 금화를 받는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('manor'), card('castle'), card('temple')] })
      .assign(0, 'king')
      .atTurn(0)
      .build();

    useAbility(s, 'king.income');
    expect(s.snapshot().players[0]!.gold).toBe(2); // 저택 + 성
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

    expect(destroyTargets(s.snapshot(), playerId(0))).toEqual([]);
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

    expect(destroyTargets(s.snapshot(), playerId(0))).toHaveLength(2);
  });

  it('종교 건물 수만큼 금화를 받는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('temple'), card('chapel'), card('castle')] })
      .assign(0, 'bishop')
      .atTurn(0)
      .build();

    useAbility(s, 'bishop.income');
    expect(s.snapshot().players[0]!.gold).toBe(2);
  });
});

describe('상인', () => {
  it('보너스 1닢과 상업 수입을 따로 받는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('tavern'), card('market')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    expect(abilities(s).sort()).toEqual(['merchant.bonus', 'merchant.income']);

    useAbility(s, 'merchant.bonus');
    expect(s.snapshot().players[0]!.gold).toBe(1);
    useAbility(s, 'merchant.income');
    expect(s.snapshot().players[0]!.gold).toBe(3);

    // 같은 능력을 두 번 쓸 수 없다
    expect(abilities(s)).toEqual([]);
  });
});

describe('건축가', () => {
  it('카드를 2장 더 받는다', () => {
    const s = aGame().players(4).assign(0, 'architect').atTurn(0).build();
    useAbility(s, 'architect.draw');
    expect(s.snapshot().players[0]!.hand).toHaveLength(2);
    expect(checkInvariants(s.snapshot())).toEqual([]);
  });

  it('건물을 3채까지 짓는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 10, hand: [card('temple'), card('chapel'), card('manor'), card('tavern')] })
      .assign(0, 'architect')
      .atTurn(0)
      .build();
    expect(s.snapshot().action!.turn!.buildLimit).toBe(3);
  });
});

describe('장군', () => {
  it('파괴비용은 건설비용보다 1닢 적고, 1닢짜리는 공짜다', () => {
    expect(destroyPrice(card('watchtower'))).toBe(0); // 망루 1닢
    expect(destroyPrice(card('prison'))).toBe(1); // 감옥 2닢
    expect(destroyPrice(card('palace'))).toBe(4); // 궁전 5닢
  });

  it('건물을 파괴하면 카드가 더미 맨 아래로 간다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 5 })
      .player(1, { city: [card('prison')] })
      .assign(0, 'warlord')
      .assign(1, 'merchant')
      .atTurn(0)
      .build();

    useAbility(s, 'warlord.destroy');
    expect(s.awaiting()?.prompt()?.type).toBe('warlordTarget');
    answer(s, {
      type: 'warlordTarget',
      target: { player: playerId(1), card: card('prison') },
    });

    expect(s.snapshot().players[1]!.city).toHaveLength(0);
    expect(s.snapshot().players[0]!.gold).toBe(4); // 5 − 1
    expect(s.snapshot().deck.at(-1)).toBe(card('prison'));
    expect(checkInvariants(s.snapshot())).toEqual([]);
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

    expect(s.snapshot().players[1]!.city).toHaveLength(7);
    expect(destroyTargets(s.snapshot(), playerId(0))).toEqual([]);
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
    expect(destroyTargets(s.snapshot(), playerId(0)).map((t) => t.card)).toEqual([card('watchtower')]);
  });

  it('군사 건물 수만큼 금화를 받는다', () => {
    const s = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('watchtower'), card('prison'), card('temple')] })
      .assign(0, 'warlord')
      .atTurn(0)
      .build();

    useAbility(s, 'warlord.income');
    expect(s.snapshot().players[0]!.gold).toBe(2);
  });
});

describe('지목은 공개 선언이라 기록에 남는다', () => {
  it('암살자가 누구를 지목했는지 남는다', () => {
    const gm = aGame().players(4).assign(0, 'assassin').assign(1, 'king').atTurn(0).build();

    useAbility(gm, 'assassin.kill');
    answer(gm, { type: 'namedCharacter', characterId: 'king' });

    expect(gm.log()).toContainEqual({
      t: 'declared',
      by: playerId(0),
      purpose: 'assassinate',
      target: 'king',
    });
  });

  it('도둑이 누구를 지목했는지 남는다', () => {
    const gm = aGame().players(4).assign(0, 'thief').assign(1, 'merchant').atTurn(0).build();

    useAbility(gm, 'thief.rob');
    answer(gm, { type: 'namedCharacter', characterId: 'merchant' });

    expect(gm.log()).toContainEqual({
      t: 'declared',
      by: playerId(0),
      purpose: 'rob',
      target: 'merchant',
    });
  });

  it('아무도 가지지 않은 캐릭터를 지목해도 기록에 남는다', () => {
    // 왕을 아무도 안 골랐다 — 그래도 "왕을 지목했다" 는 공개된 사실이다
    const gm = aGame().players(4).assign(0, 'assassin').assign(1, 'merchant').atTurn(0).build();

    useAbility(gm, 'assassin.kill');
    answer(gm, { type: 'namedCharacter', characterId: 'king' });

    expect(gm.log().some((e) => e.t === 'declared' && e.target === 'king')).toBe(true);
  });

  it('공개 선언이므로 누구의 시점에서도 가려지지 않는다', () => {
    const gm = aGame().players(4).assign(0, 'assassin').assign(1, 'king').atTurn(0).build();

    useAbility(gm, 'assassin.kill');
    answer(gm, { type: 'namedCharacter', characterId: 'king' });

    for (const player of gm.players()) {
      const seen = player.view().log.some((e) => e.t === 'declared');
      expect(seen, `P${player.id} 의 시점에서 지목이 사라졌습니다`).toBe(true);
    }
  });
});

describe('무작위 대전에서 능력이 실제로 발동한다', () => {
  it('암살·절도·파괴·왕관 이동이 모두 로그에 나타난다', async () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const s = await playRandomGame({ seed, playerCount: 5 });
      for (const e of s.log()) seen.add(e.t);
    }
    expect(seen).toContain('skipped'); // 암살
    expect(seen).toContain('stolen'); // 도둑
    expect(seen).toContain('destroyed'); // 장군
    expect(seen).toContain('crownMoved'); // 왕
  });
});
