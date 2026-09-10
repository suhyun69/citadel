import type { AnyChoice, MainAction, PendingDecision } from './types/decision';
import type { GameState } from './types/state';

function sameAction(a: MainAction, b: MainAction): boolean {
  if (a.t !== b.t) return false;
  if (a.t === 'build' && b.t === 'build') return a.card === b.card;
  if (a.t === 'useBuilding' && b.t === 'useBuilding') return a.building === b.building;
  return true;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const walk = (start: number, acc: T[]): void => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i] as T);
      walk(i + 1, acc);
      acc.pop();
    }
  };
  walk(0, []);
  return out;
}

/**
 * 합법 수 열거. 조합 폭발이 나는 결정(마술사의 버릴 카드 부분집합)은 null 을
 * 돌려주고, 그때는 봇이 결정에 실린 제약을 직접 해석한다.
 */
export function legalChoices(d: PendingDecision): AnyChoice[] | null {
  switch (d.type) {
    case 'selectCharacter':
      return d.options.map((characterId) => ({ type: 'selectCharacter', characterId }));
    case 'gatherMode':
      return [
        { type: 'gatherMode', mode: 'gold' },
        { type: 'gatherMode', mode: 'cards' },
      ];
    case 'keepDrawn':
      return combinations(d.drawn, d.keep).map((keep) => ({ type: 'keepDrawn', keep }));
    case 'mainAction':
      return d.options.map((action) => ({ type: 'mainAction', action }));
    case 'namedCharacter':
      return d.options.map((characterId) => ({ type: 'namedCharacter', characterId }));
    case 'warlordTarget': {
      const out: AnyChoice[] = d.options.map((o) => ({
        type: 'warlordTarget' as const,
        target: { player: o.player, card: o.card },
      }));
      out.push({ type: 'warlordTarget', target: null });
      return out;
    }
    case 'magicianMode':
    case 'buildPayment':
      return null; // 부분집합 선택 — 열거하지 않는다
  }
}

export function isLegal(state: GameState, d: PendingDecision, c: AnyChoice): boolean {
  if (d.type !== c.type) return false;

  switch (d.type) {
    case 'selectCharacter':
      return c.type === 'selectCharacter' && d.options.includes(c.characterId);
    case 'gatherMode':
      return c.type === 'gatherMode' && (c.mode === 'gold' || c.mode === 'cards');
    case 'keepDrawn': {
      if (c.type !== 'keepDrawn') return false;
      if (c.keep.length !== d.keep) return false;
      if (new Set(c.keep).size !== c.keep.length) return false;
      return c.keep.every((card) => d.drawn.includes(card));
    }
    case 'mainAction':
      return c.type === 'mainAction' && d.options.some((o) => sameAction(o, c.action));
    case 'namedCharacter':
      return c.type === 'namedCharacter' && d.options.includes(c.characterId);
    case 'warlordTarget': {
      if (c.type !== 'warlordTarget') return false;
      if (c.target === null) return d.canSkip;
      return d.options.some((o) => o.player === c.target?.player && o.card === c.target?.card);
    }
    case 'magicianMode': {
      if (c.type !== 'magicianMode') return false;
      if (c.mode === 'swap') return d.canSwapWith.includes(c.target);
      const hand = state.players[d.player]?.hand ?? [];
      return c.discard.every((card) => hand.includes(card)) && new Set(c.discard).size === c.discard.length;
    }
    case 'buildPayment': {
      if (c.type !== 'buildPayment') return false;
      const p = state.players[d.player];
      if (!p) return false;
      if (c.gold < 0 || c.cards.length > d.maxCards) return false;
      if (c.gold + c.cards.length !== d.cost) return false;
      if (c.gold > p.gold) return false;
      return c.cards.every((card) => p.hand.includes(card)) && new Set(c.cards).size === c.cards.length;
    }
  }
}
