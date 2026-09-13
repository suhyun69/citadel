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

    case 'warrants': {
      // 인장 1장 + 허풍 2장. 8캐릭터 기준 105가지로 열거할 만하다.
      const out: Choice[] = [];
      for (const sealed of prompt.options) {
        const rest = prompt.options.filter((id) => id !== sealed);
        for (const decoys of combinations(rest, 2)) {
          out.push({ type: 'warrants', sealed, decoys });
        }
      }
      return out;
    }

    case 'seize':
      return [
        { type: 'seize', seize: true },
        { type: 'seize', seize: false },
      ];

    case 'pickPlayer':
      return prompt.options.map((player) => ({ type: 'pickPlayer', player }));

    case 'takeCard':
      return prompt.options.map((card) => ({ type: 'takeCard', card }));

    case 'buildTaken':
      return [
        { type: 'buildTaken', build: true },
        { type: 'buildTaken', build: false },
      ];

    case 'freeBuild':
      return prompt.options.map((card) => ({ type: 'freeBuild', card }));

    case 'sacrificeBuild': {
      const out: Choice[] = prompt.options.map((sacrifice) => ({
        type: 'sacrificeBuild' as const,
        sacrifice,
      }));
      // 금화가 모자라면 "그냥 내기" 는 애초에 고를 수 없다.
      if (prompt.canPayGold) out.push({ type: 'sacrificeBuild', sacrifice: null });
      return out;
    }

    case 'rank8Target': {
      const out: Choice[] = prompt.options.map((o) => ({
        type: 'rank8Target' as const,
        target: { player: o.player, card: o.card },
      }));
      out.push({ type: 'rank8Target', target: null });
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
