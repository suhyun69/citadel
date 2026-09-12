import { describe, expect, it } from 'vitest';
import { createGame, type GameMaster } from '@/engine';
import { playerId } from '@/engine/state/ids';
import type { Choice } from '@/engine/state/prompt';
import { replay } from '@/runtime/replay';
import { aGame, card } from './helpers/builder';
import { playRandomGame } from './helpers/run';

function toPrompt(gm: GameMaster): GameMaster {
  while (!gm.awaiting() && !gm.isOver()) gm.advance();
  return gm;
}

describe('GameMaster — 진행과 승인', () => {
  it('질문이 없으면 스스로 진행하고, 생기면 멈춰서 기다린다', () => {
    const gm = createGame({ seed: 1, playerCount: 4 });
    expect(gm.awaiting()).toBeNull();
    expect(gm.phase()).toBe('selection');

    toPrompt(gm);
    expect(gm.awaiting()).not.toBeNull();
    // 멈춰 있는 동안은 몇 번을 물어도 같은 사람에게 같은 질문이다
    const first = gm.awaiting()!;
    expect(gm.awaiting()!.id).toBe(first.id);
    expect(gm.promptFor(first.id)?.type).toBe('selectCharacter');
  });

  it('답을 기다리는 중에는 advance() 를 거부한다', () => {
    const gm = toPrompt(createGame({ seed: 1, playerCount: 4 }));
    expect(() => gm.advance()).toThrow(/답해야 할 질문/);
  });

  it('차례가 아닌 플레이어의 제출은 이유와 함께 거절한다', () => {
    const gm = toPrompt(createGame({ seed: 1, playerCount: 4 }));
    const asked = gm.awaiting()!;
    const other = gm.players().find((p) => p.id !== asked.id)!;

    const choice = gm.optionsFor(asked.id)![0]!;
    const verdict = other.submit(choice);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok === false && verdict.reason).toContain(`P${asked.id}`);
  });

  it('거절된 제출은 상태를 하나도 바꾸지 않는다', () => {
    const gm = toPrompt(createGame({ seed: 2, playerCount: 4 }));
    const before = JSON.stringify(gm.snapshot());

    const asked = gm.awaiting()!;
    const bogus: Choice = { type: 'gatherMode', mode: 'gold' }; // 지금은 캐릭터를 고를 차례다
    const verdict = asked.submit(bogus);

    expect(verdict.ok).toBe(false);
    expect(JSON.stringify(gm.snapshot())).toBe(before);
    expect(gm.history()).toHaveLength(0);
  });

  it('approve 는 판정만 하고 적용하지 않는다', () => {
    const gm = toPrompt(createGame({ seed: 3, playerCount: 4 }));
    const asked = gm.awaiting()!;
    const choice = gm.optionsFor(asked.id)![0]!;

    expect(gm.approve(asked.id, choice).ok).toBe(true);
    expect(gm.history()).toHaveLength(0); // 승인만으로는 아무 일도 없다

    expect(asked.submit(choice).ok).toBe(true);
    expect(gm.history()).toHaveLength(1);
  });

  it('스냅샷은 직렬화 가능하고, 제출 기록으로 판이 되살아난다', async () => {
    const gm = await playRandomGame({ seed: 11, playerCount: 5 });

    expect(() => JSON.stringify(gm.snapshot())).not.toThrow();
    const restored = replay({ config: gm.snapshot().config, choices: gm.history() });
    expect(restored.result()).toEqual(gm.result());
  });
});

describe('Player — 자기 시점', () => {
  it('핸들은 낡지 않는다 — 제출 뒤에도 현재 값을 읽는다', () => {
    const gm = toPrompt(
      aGame().players(4).player(0, { gold: 0 }).assign(0, 'merchant').atTurn(0).build(),
    );
    const me = gm.player(playerId(0));
    expect(me.gold()).toBe(0);

    me.submit({ type: 'mainAction', action: { t: 'useAbility', ability: 'merchant.bonus' } });

    // 같은 핸들이 새 값을 본다
    expect(me.gold()).toBe(1);
  });

  it('view() 는 남의 손패를 장수로만 보여준다', () => {
    const gm = aGame()
      .players(4)
      .player(0, { hand: [card('temple')] })
      .player(1, { hand: [card('chapel'), card('manor'), card('castle')] })
      .assign(0, 'merchant')
      .atTurn(0)
      .build();

    const view = gm.player(playerId(0)).view();
    expect(view.me.hand).toEqual([card('temple')]);

    const opponent = view.opponents.find((o) => o.id === playerId(1))!;
    expect(opponent.handCount).toBe(3);
    expect(opponent).not.toHaveProperty('hand');
  });

  it('왕관 주인을 알려준다', () => {
    const gm = aGame().players(4).crown(2).assign(0, 'merchant').atTurn(0).build();
    expect(gm.crownHolder().id).toBe(playerId(2));
    expect(gm.player(playerId(2)).hasCrown()).toBe(true);
    expect(gm.player(playerId(0)).hasCrown()).toBe(false);
  });
});

describe('Character — 캐릭터가 기여하는 몫', () => {
  it('맡은 캐릭터의 신원과 상태를 보여준다', () => {
    const gm = aGame().players(4).assign(0, 'warlord').atTurn(0).build();
    const character = gm.player(playerId(0)).character()!;

    expect(character.id).toBe('warlord');
    expect(character.rank).toBe(8);
    expect(character.name).toBe('장군');
    expect(character.isRevealed()).toBe(true);
    expect(character.isKilled()).toBe(false);
  });

  it('암살당한 캐릭터를 드러낸다', () => {
    const gm = aGame()
      .players(4)
      .assign(0, 'king')
      .player(0, { killed: true, revealed: true })
      .assign(1, 'merchant')
      .atTurn(1)
      .build();

    expect(gm.player(playerId(0)).character()!.isKilled()).toBe(true);
  });

  it('종류별 수입을 미리 보여주되 지급하지는 않는다', () => {
    const gm = aGame()
      .players(4)
      .player(0, { gold: 0, city: [card('temple'), card('chapel'), card('manor')] })
      .assign(0, 'bishop')
      .atTurn(0)
      .build();

    const character = gm.player(playerId(0)).character()!;
    expect(character.pendingIncome()).toEqual({ kind: 'religious', amount: 2 });
    expect(gm.player(playerId(0)).gold()).toBe(0); // 미리 보기일 뿐이다
  });

  it('수입이 없는 캐릭터는 null 을 준다', () => {
    const gm = aGame().players(4).assign(0, 'assassin').atTurn(0).build();
    expect(gm.player(playerId(0)).character()!.pendingIncome()).toBeNull();
  });

  /**
   * ★ 이 파일에서 가장 중요한 테스트.
   *
   * Character.abilities() 는 선택지 전부가 아니라 **캐릭터가 기여한 몫**이다.
   * 도시의 특수 건물(실험실·대장간)과 기본 행동은 Player.options() 에만 있다.
   * 이 구분이 무너지면 건물 능력이 조용히 사라진다.
   */
  it('캐릭터 능력은 선택지의 부분집합일 뿐, 건물 능력은 플레이어 쪽에만 있다', () => {
    const gm = toPrompt(
      aGame()
        .players(4)
        .player(0, { gold: 5, hand: [card('temple')], city: [card('laboratory'), card('smithy')] })
        .assign(0, 'warlord')
        .atTurn(0)
        .build(),
    );

    const me = gm.player(playerId(0));
    const abilityKeys = me.character()!.abilities().map((a) => (a.t === 'useAbility' ? a.ability : a.t));
    const optionLabels = me
      .options()!
      .map((c) => (c.type === 'mainAction' ? c.action : null))
      .filter((a) => a !== null)
      .map((a) => (a.t === 'useAbility' ? a.ability : a.t === 'useBuilding' ? a.building : a.t));

    // 캐릭터는 자기 능력만 내놓는다
    expect(abilityKeys).toContain('warlord.income');
    expect(abilityKeys).not.toContain('laboratory');
    expect(abilityKeys).not.toContain('smithy');

    // 플레이어의 선택지에는 건물 능력과 기본 행동까지 모여 있다
    expect(optionLabels).toContain('warlord.income');
    expect(optionLabels).toContain('laboratory');
    expect(optionLabels).toContain('smithy');
    expect(optionLabels).toContain('build');
    expect(optionLabels).toContain('endTurn');

    // 캐릭터가 내놓은 것은 모두 플레이어 선택지 안에 있다
    for (const key of abilityKeys) expect(optionLabels).toContain(key);
  });

  it('자기 차례가 아니면 능력을 내놓지 않는다', () => {
    const gm = aGame().players(4).assign(0, 'warlord').assign(1, 'merchant').atTurn(1).build();
    expect(gm.player(playerId(0)).character()!.abilities()).toEqual([]);
  });
});
