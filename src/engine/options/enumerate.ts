import type { Choice, MainAction, Prompt } from '../state/prompt';

/**
 * 질문 하나에 대한 합법적인 답을 전부 늘어놓는다.
 *
 * **상태를 보지 않는다** — 질문에 실린 정보만으로 열거된다. 덕분에 봇이
 * 게임 마스터의 내부를 들여다보지 않고도 선택지를 계산할 수 있다.
 *
 * 조합 폭발이 나는 질문(마술사의 버릴 카드 부분집합, 도적 소굴의 지불 조합)은
 * null 을 돌려준다. 그때는 답하는 쪽이 질문에 실린 제약을 직접 해석한다.
 */
export function legalChoices(prompt: Prompt): Choice[] | null {
  switch (prompt.type) {
    case 'selectCharacter':
      return prompt.options.map((characterId) => ({ type: 'selectCharacter', characterId }));

    case 'gatherMode':
      return [
        { type: 'gatherMode', mode: 'gold' },
        { type: 'gatherMode', mode: 'cards' },
      ];

    case 'keepDrawn':
      return combinations(prompt.drawn, prompt.keep).map((keep) => ({ type: 'keepDrawn', keep }));

    case 'mainAction':
      return prompt.options.map((action) => ({ type: 'mainAction', action }));

    case 'namedCharacter':
      return prompt.options.map((characterId) => ({ type: 'namedCharacter', characterId }));

    case 'discardCard':
      return prompt.options.map((card) => ({ type: 'discardCard', card }));

    case 'warlordTarget': {
      const out: Choice[] = prompt.options.map((o) => ({
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

/** 두 행동이 같은 것을 가리키는가. 승인 검사도 이걸 쓴다. */
export function sameAction(a: MainAction, b: MainAction): boolean {
  if (a.t !== b.t) return false;
  if (a.t === 'build' && b.t === 'build') return a.card === b.card;
  if (a.t === 'useBuilding' && b.t === 'useBuilding') return a.building === b.building;
  if (a.t === 'useAbility' && b.t === 'useAbility') return a.ability === b.ability;
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
